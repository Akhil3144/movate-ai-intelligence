"""Create a curated, validated deployment snapshot. Never copy SQLite, keys, or unrelated files."""
import hashlib
import json
import shutil
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend import data
from backend.runtime import serverless


def prepare():
    if serverless():
        raise RuntimeError('Prepare the bundle in the normal local development environment, not inside a Vercel function.')
    status=data.get_status()
    if not status.get('ready') or not data.DB.is_file():
        raise RuntimeError('Import and validate the original dataset locally first: python -m backend.data')
    if status.get('errors') or any(r['orphan_rows'] or r['duplicate_parent_keys'] for r in status['relationships']):
        raise RuntimeError('Source validation failed; deployment bundle was not changed.')
    counts={t:data.query(f'SELECT count(*) n FROM {data.ident(t)}')[0]['n'] for t in data.TABLES}
    if counts['opportunity_catalog']!=status['canonical_opportunities'] or counts['source_opportunities']!=status['source_entries']:
        raise RuntimeError('Traceability counts do not match validation status.')
    # Preserve exact workbook cells and all diagnostics, remove machine-local path information.
    clean=json.loads(json.dumps(status))
    clean['archive']='Bundled synthetic dataset snapshot'
    clean['workbooks']=[Path(p).name for p in status.get('workbooks',[])]
    clean['needed_paths']=[]
    clean['deployment']={'read_only':True,'refresh':'Rebuild this validated bundle locally and redeploy.','persistence':'Browser-local chats and action plans; not shared across devices.'}
    for match in clean.get('source_matches',[]):
        if match.get('workbook'):
            match['workbook']['file']=Path(match['workbook']['file']).name
    encoded=json.dumps(clean,indent=2,ensure_ascii=False)
    if str(Path.home()) in encoded:
        raise RuntimeError('Machine-local path remains in deployment metadata')
    dest=data.ROOT/'deployment/data'
    dest.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(data.DB,dest/'movate.duckdb')
    (dest/'status.json').write_text(encoded)
    manifest={'version':1,'synthetic':True,'duckdb_version':'1.5.6','table_counts':counts,'files':{}}
    for name in ['movate.duckdb','status.json']:
        content=(dest/name).read_bytes()
        manifest['files'][name]={'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content)}
    (dest/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps({'ready':True,'tables':len(counts),'opportunities':counts['opportunity_catalog'],'source_entries':counts['source_opportunities'],'bundle_bytes':sum(f['bytes'] for f in manifest['files'].values()),'destination':'deployment/data','sqlite_included':False},indent=2))


if __name__=='__main__':
    prepare()
