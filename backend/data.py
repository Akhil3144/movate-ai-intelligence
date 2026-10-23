"""Source-preserving ingestion. No replacement records are ever generated."""
import hashlib
import json
import os
import re
import shutil
import threading
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import duckdb
from decimal import Decimal
from .runtime import serverless, bundle_dir
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
if not serverless():
    load_dotenv(ROOT / '.env')
STORE = bundle_dir() if serverless() else ROOT / 'data' / 'processed'
if not serverless():
    STORE.mkdir(parents=True, exist_ok=True)
DB = STORE / 'movate.duckdb'
STATUS = STORE / 'status.json'
LOCK = threading.RLock()
TABLES = 'programs employees interactions tickets qa_audits coaching_actions training_enrollments courses trainers sales_leads hr_cases hr_onboarding employee_recognitions knowledge_articles daily_program_kpis source_opportunities opportunity_catalog solution_alternatives scenario_estimates relational_map data_dictionary_index'.split()


def discover():
    homes = [Path.home() / 'Downloads', Path.home() / 'Desktop', ROOT / 'data']
    zips, books = [], []
    if os.getenv('MOVATE_DATA_ZIP'):
        zips.append(Path(os.environ['MOVATE_DATA_ZIP']).expanduser())
    if os.getenv('MOVATE_WORKBOOK_DIR'):
        homes.insert(0, Path(os.environ['MOVATE_WORKBOOK_DIR']).expanduser())
    # Bound discovery to relevant roots and prune dependency/system folders.
    for base in homes:
        if not base.is_dir():
            continue
        for folder, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in {'node_modules', 'Library', 'venv', '__pycache__'}]
            if len(Path(folder).relative_to(base).parts) > 5:
                dirs[:] = []
            for f in files:
                if f.startswith('Movate_Synthetic_Dataset_v1') and f.endswith('.zip'):
                    zips.append(Path(folder) / f)
                if f.startswith('Opportunities for automation and process improvement') and f.endswith('.xlsx'):
                    books.append(Path(folder) / f)
    unique_books = {}
    for book in books:
        unique_books.setdefault(book.name.replace('(1)', '').replace(' (1)', ''), book)
    return zips, list(unique_books.values())


def ident(s):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', s):
        raise ValueError('Invalid internal identifier')
    return '"' + s + '"'


def query(sql, params=None):
    # Only application-owned query templates call this function. Never accept model/user SQL.
    if serverless():
        ensure_bundle()
    config = {'enable_external_access': False, 'threads': 1, 'memory_limit': '256MB', 'max_temp_directory_size': '0B'}
    with LOCK, duckdb.connect(str(DB), read_only=True, config=config) as con:
        cursor = con.execute(sql, params or [])
        columns = [c[0] for c in cursor.description]
        def value(v):
            if isinstance(v, Decimal):
                return float(v)
            if hasattr(v, 'isoformat'):
                return v.isoformat()
            return v
        return [dict(zip(columns, (value(v) for v in row))) for row in cursor.fetchall()]


def workbook_rows(paths):
    import openpyxl
    rows, seen = [], set()
    for path in paths:
        normalized = path.name.replace('(1)', '').replace(' (1)', '')
        if normalized in seen:
            continue
        seen.add(normalized)
        book = openpyxl.load_workbook(path, read_only=True, data_only=True)
        for sheet_index, sheet in enumerate(book.worksheets, 1):
            header = None
            for row_no, cells in enumerate(sheet.iter_rows(values_only=True), 1):
                values = [str(c).strip() if c is not None else '' for c in cells]
                if 'Opportunity' in values:
                    header = values
                    continue
                if not any(values):
                    continue
                title = values[header.index('Opportunity')] if header and len(values) > header.index('Opportunity') else ''
                rows.append({'file': str(path), 'filename': path.name, 'sheet': sheet.title, 'sheet_index': sheet_index,
                             'row': row_no, 'values': list(cells), 'opportunity_title': title,
                             'is_requirement': bool(header and title and title != 'Opportunity')})
        book.close()
    return rows


def _ingest(zip_path=None):
    import pandas as pd
    with LOCK:
        zips, books = discover()
        archive = Path(zip_path).expanduser() if zip_path else next((p for p in zips if p.is_file()), None)
        raw = ROOT / 'data/raw/movate_synthetic_data'
        status = {'ready': False, 'imported_at': datetime.now(timezone.utc).isoformat(), 'errors': [], 'warnings': [],
                  'needed_paths': [str(Path.home() / 'Downloads/Movate_Synthetic_Dataset_v1.zip'), str(Path.home() / 'Desktop/Movate_Synthetic_Dataset_v1.zip'), str(ROOT / 'data/Movate_Synthetic_Dataset_v1.zip'), 'Or configure MOVATE_DATA_ZIP and MOVATE_WORKBOOK_DIR in .env']}
        if archive:
            try:
                with zipfile.ZipFile(archive) as z:
                    destination = (ROOT / 'data/raw').resolve()
                    for info in z.infolist():
                        target = (destination / info.filename).resolve()
                        if not target.is_relative_to(destination) or info.file_size > 100_000_000:
                            raise ValueError('Archive contains an unsafe path or oversized entry')
                    z.extractall(destination)
                status['archive'] = str(archive)
                status['archive_sha256'] = hashlib.sha256(archive.read_bytes()).hexdigest()
            except Exception as exc:
                status['errors'].append(str(exc))
                STATUS.write_text(json.dumps(status, indent=2))
                return status
        if not raw.is_dir() or not (raw / 'README_FIRST.txt').exists():
            status['errors'].append('Dataset not found; configure MOVATE_DATA_ZIP in .env, then import.')
            STATUS.write_text(json.dumps(status, indent=2))
            return status
        status['source_readme'] = (raw / 'README_FIRST.txt').read_text()
        frames = {}
        for table in TABLES:
            path = raw / (table + '.csv')
            if not path.exists():
                status['errors'].append(f'Missing required table: {path}')
                continue
            frames[table] = pd.read_csv(path)
        if len(frames) != len(TABLES):
            STATUS.write_text(json.dumps(status, indent=2))
            return status
        schema = {}
        for name, frame in frames.items():
            schema[name] = {'rows': len(frame), 'columns': [{'name': c, 'type': str(frame[c].dtype), 'nulls': int(frame[c].isna().sum()),
                'distinct': int(frame[c].nunique()), 'description': c.replace('_', ' ') + ' (inferred from actual header)'} for c in frame.columns]}
            for c in frame.columns:
                if c.endswith('_date') or c.endswith('_at') or c == 'date':
                    parsed = pd.to_datetime(frame[c], errors='coerce')
                    schema[name].setdefault('dates', {})[c] = {'min': str(parsed.min()), 'max': str(parsed.max()), 'invalid': int((frame[c].notna() & parsed.isna()).sum())}
                    if (frame[c].notna() & parsed.isna()).any():
                        status['errors'].append(f'{name}.{c}: invalid dates')
        primary_keys = {'programs':'program_id','employees':'employee_id','interactions':'interaction_id','tickets':'ticket_id','qa_audits':'audit_id','coaching_actions':'coaching_id','training_enrollments':'enrollment_id','courses':'course_id','trainers':'trainer_id','sales_leads':'lead_id','hr_cases':'case_id','hr_onboarding':'onboarding_id','employee_recognitions':'recognition_id','knowledge_articles':'article_id','source_opportunities':'source_id','opportunity_catalog':'opportunity_id','solution_alternatives':'option_id','scenario_estimates':'scenario_id'}
        for table, key in primary_keys.items():
            if key not in frames[table] or frames[table][key].isna().any() or frames[table][key].duplicated().any():
                status['errors'].append(f'Invalid primary key: {table}.{key}')
        for table, column, low, high in [('qa_audits','qa_score',0,100),('interactions','csat_score',1,5),('interactions','aht_minutes',0,1440),('training_enrollments','pre_assessment_score',0,100),('training_enrollments','post_assessment_score',0,100),('scenario_estimates','effort_reduction_pct_assumed',0,100)]:
            values = pd.to_numeric(frames[table][column],errors='coerce')
            if values.isna().any() or not values.between(low,high).all():
                status['errors'].append(f'Invalid metric range/type: {table}.{column}')
        coherence = []
        for child,parent,key,fields in [('interactions','employees','employee_id',['program_id']),('qa_audits','interactions','interaction_id',['employee_id','program_id']),('coaching_actions','qa_audits','audit_id',['employee_id','program_id']),('tickets','interactions','interaction_id',['program_id','ticket_id'])]:
            merged = frames[child].merge(frames[parent],on=key,suffixes=('_child','_parent'))
            count = sum(int((merged[field+'_child'] != merged[field+'_parent']).sum()) for field in fields)
            coherence.append({'child':child,'parent':parent,'inconsistent_fields':count})
            if count:
                status['errors'].append(f'Inconsistent contextual join: {child} to {parent}')
        status['contextual_relationship_checks'] = coherence
        dictionary = frames['data_dictionary_index']
        for _, d in dictionary.iterrows():
            if d['table'] in frames:
                f = frames[d['table']]
                if len(f) != d['row_count'] or list(f.columns) != [c.strip() for c in d['columns'].split(',')]:
                    status['errors'].append(f"Dictionary/schema mismatch: {d['table']}")
        relations = frames['relational_map'].to_dict('records')
        # Also check every conventional ID link, beyond the supplied relationship map.
        targets = {'program_id': ('programs','program_id'), 'employee_id': ('employees','employee_id'), 'interaction_id': ('interactions','interaction_id'),
                   'ticket_id': ('tickets','ticket_id'), 'audit_id': ('qa_audits','audit_id'), 'course_id': ('courses','course_id'), 'trainer_id': ('trainers','trainer_id'),
                   'opportunity_id': ('opportunity_catalog','opportunity_id'), 'option_id': ('solution_alternatives','option_id'), 'knowledge_article_id': ('knowledge_articles','article_id')}
        for child, frame in frames.items():
            for fk, (parent, pk) in targets.items():
                if fk in frame and parent != child:
                    rel = {'parent_table': parent, 'parent_key': pk, 'child_table': child, 'foreign_key': fk}
                    if rel not in relations:
                        relations.append(rel)
        checks = []
        for r in relations:
            p, c = frames[r['parent_table']], frames[r['child_table']]
            valid = set(p[r['parent_key']].dropna())
            missing = c[r['foreign_key']].notna() & ~c[r['foreign_key']].isin(valid)
            duplicates = int(p[r['parent_key']].duplicated().sum())
            checks.append({**r, 'orphan_rows': int(missing.sum()), 'duplicate_parent_keys': duplicates})
            if missing.any() or duplicates:
                status['errors'].append(f"Invalid relationship {r}: {int(missing.sum())} orphans, {duplicates} duplicate parent keys")
        src, cat = frames['source_opportunities'], frames['opportunity_catalog']
        for _, opp in cat.iterrows():
            actual = set(src.loc[src.opportunity_id == opp.opportunity_id, 'source_id'])
            if actual != set(opp.source_ids.split(';')) or len(actual) != opp.source_reference_count:
                status['errors'].append(f'Source mapping mismatch: {opp.opportunity_id}')
        originals = ROOT / 'data/workbooks'
        originals.mkdir(parents=True,exist_ok=True)
        for book in books:
            target = originals / book.name
            if book.resolve() != target.resolve() and not target.exists():
                shutil.copy2(book,target)
        workrows = workbook_rows(books)
        (STORE / 'workbook_rows.json').write_text(json.dumps(workrows, default=str, indent=2))
        requirement_rows = [r for r in workrows if r['is_requirement']]
        matches = []
        for _, s in src.iterrows():
            normalized = s.source_file.replace('(1)', '')
            match = next((r for r in requirement_rows if r['filename'].replace('(1)', '') == normalized and r['sheet_index'] == s.source_sheet and r['row'] == s.source_row), None)
            exact = bool(match and s.opportunity_title == match['opportunity_title'] and all(str(s[c]) in [str(v) for v in match['values']] for c in ['problem_statement', 'proposed_solution','claimed_impact_original']))
            normalized_match = bool(match and s.opportunity_title == match['opportunity_title'] and all(str(s[c]).strip() in [str(v).strip() for v in match['values']] for c in ['problem_statement', 'proposed_solution','claimed_impact_original']))
            matches.append({'source_id': s.source_id, 'opportunity_id': s.opportunity_id, 'matched': exact, 'normalized_match': normalized_match, 'workbook': match})
            if books and not exact:
                status['warnings'].append(f'Workbook surrounding-whitespace difference: {s.source_id}; exact original cells preserved' if normalized_match else f'Workbook source text mismatch: {s.source_id}; inspect preserved original cells')
        if not books:
            status['warnings'].append('Original XLSX files unavailable. CSV source text is the authoritative available source.')
        interactions = frames['interactions'].copy()
        interactions['date'] = interactions.created_at.str[:10]
        recomputed = interactions.groupby(['program_id','date']).agg(contacts=('interaction_id','size'), average_aht_minutes=('aht_minutes','mean'), fcr_rate=('first_contact_resolved','mean'), avg_csat=('csat_score','mean'), sla_attainment_rate=('sla_met','mean'), cost_to_serve_usd=('service_cost_usd','sum'), peak_contacts=('is_campaign_peak','sum')).reset_index()
        joined = frames['daily_program_kpis'].merge(recomputed, on=['program_id','date'], suffixes=('_source','_computed'), how='outer', indicator=True)
        reconciliation = {}
        for metric in ['contacts','average_aht_minutes','fcr_rate','avg_csat','sla_attainment_rate','cost_to_serve_usd','peak_contacts']:
            delta = (joined[metric+'_source'] - joined[metric+'_computed']).abs()
            tolerance = 0.000051 if metric.endswith('rate') else 0.0051 if metric not in ['contacts','peak_contacts'] else 0
            reconciliation[metric] = {'mismatched_groups': int((delta > tolerance).sum()), 'max_absolute_difference': float(delta.max()), 'tolerance': tolerance}
        if (joined['_merge'] != 'both').any():
            status['errors'].append('Daily KPI date/program groups do not match interactions')
        for metric, check in reconciliation.items():
            if check['mismatched_groups']:
                status['warnings'].append(f'Daily KPI definition/rounding mismatch: {metric}; analytics recomputed from interactions')
        for _, s in frames['scenario_estimates'].merge(frames['solution_alternatives'], on='option_id').iterrows():
            gross = s.annual_addressable_hours_assumed * s.loaded_hourly_cost_usd_assumed * s.effort_reduction_pct_assumed / 100
            cost = s.one_time_cost_usd_assumed + 12 * s.monthly_operating_cost_usd_assumed
            if abs(gross - s.annual_gross_savings_usd_estimate) > .01 or abs(cost - s.first_year_cost_usd_assumed) > .01 or abs(gross-cost-s.first_year_net_benefit_usd_estimate) > .01:
                status['errors'].append(f'Scenario equation mismatch: {s.scenario_id}')
        status.update({'schema': schema, 'relationships': checks, 'reconciliation': reconciliation, 'workbooks': [str(b) for b in books], 'workbook_nonempty_rows': len(workrows), 'workbook_requirement_rows': len(requirement_rows), 'source_matches': matches,
                       'source_entries': len(src), 'canonical_opportunities': len(cat), 'intentional_repeated_mappings': src.opportunity_id.value_counts().loc[lambda x:x>1].to_dict(),
                       'window': {'start': interactions.date.min(), 'end': interactions.date.max()}, 'row_count_benchmarks': {t:len(frames[t]) for t in ['interactions','qa_audits','employees','training_enrollments']}})
        if not status['errors']:
            temp = STORE / 'import.duckdb'
            if temp.exists():
                temp.unlink()
            with duckdb.connect(str(temp)) as con:
                for name, df in frames.items():
                    typed = df.copy()
                    for column in schema[name].get('dates', {}):
                        parsed = pd.to_datetime(typed[column], errors='raise')
                        typed[column] = parsed if column.endswith('_at') else parsed.dt.date
                    con.register('incoming', typed)
                    con.execute(f'CREATE TABLE {ident(name)} AS SELECT * FROM incoming')
                    stored = {row[0]:row[1] for row in con.execute(f'DESCRIBE {ident(name)}').fetchall()}
                    for column in schema[name]['columns']:
                        column['database_type'] = stored[column['name']]
            temp.replace(DB)
            status['ready'] = True
        STATUS.write_text(json.dumps(status, indent=2, default=str))
        return status


def ingest(zip_path=None):
    if serverless():
        raise DataInitializationError('Hosted imports are disabled. Rebuild the validated deployment bundle and redeploy.')
    try:
        return _ingest(zip_path)
    except Exception as exc:
        status = {'ready':False,'errors':[f'Import failed: {type(exc).__name__}: {exc}'],'warnings':[],
                  'needed_paths':['MOVATE_DATA_ZIP=/absolute/path/Movate_Synthetic_Dataset_v1.zip'],
                  'previous_database_preserved': DB.exists()}
        STATUS.write_text(json.dumps(status,indent=2))
        return status


def get_status():
    if serverless():
        ensure_bundle()
    if STATUS.exists():
        return json.loads(STATUS.read_text())
    return {'ready': False, 'errors': ['Data has not been imported.'], 'needed_paths': ['MOVATE_DATA_ZIP=/absolute/path/Movate_Synthetic_Dataset_v1.zip']}


class DataInitializationError(RuntimeError):
    pass


_bundle_validated = None


def ensure_bundle():
    """Validate once per warm process; never discover, extract, create or modify data."""
    global _bundle_validated
    identity = str(DB.resolve())
    if _bundle_validated == identity:
        return
    with LOCK:
        if _bundle_validated == identity:
            return
        try:
            manifest = json.loads((DB.parent / 'manifest.json').read_text())
            for name in ['movate.duckdb', 'status.json']:
                actual = hashlib.sha256((DB.parent / name).read_bytes()).hexdigest()
                if actual != manifest['files'][name]['sha256']:
                    raise ValueError('Bundle checksum mismatch')
            status = json.loads(STATUS.read_text())
            if not status.get('ready') or set(manifest['table_counts']) != set(TABLES):
                raise ValueError('Incomplete dataset manifest')
            with duckdb.connect(str(DB), read_only=True, config={'enable_external_access':False, 'threads':1, 'memory_limit':'256MB', 'max_temp_directory_size':'0B'}) as con:
                for table, expected in manifest['table_counts'].items():
                    if con.execute(f'SELECT count(*) FROM {ident(table)}').fetchone()[0] != expected:
                        raise ValueError('Dataset row count mismatch')
            _bundle_validated = identity
        except Exception as exc:
            raise DataInitializationError('Bundled dataset initialization failed. Redeploy a validated bundle; check server logs for details.') from exc


if __name__ == '__main__':
    s = ingest()
    print(json.dumps({k:v for k,v in s.items() if k not in {'schema','source_matches','source_readme'}}, indent=2))
    raise SystemExit(0 if s['ready'] else 1)
