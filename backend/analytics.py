from datetime import date
from fastapi import HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from .data import query, get_status

ROLES = {'Executive', 'QA Manager', 'Training Manager', 'HR Manager'}


class Filters(BaseModel):
    program: str = ''
    start: date = date(2026, 7, 1)
    end: date = date(2026, 10, 15)

    @model_validator(mode='after')
    def ordered(self):
        if self.start > self.end:
            raise ValueError('Start date must precede end date')
        if self.end < date(2026,7,1) or self.start > date(2026,10,15):
            raise ValueError('Reporting period must intersect 2026-07-01 through 2026-10-15')
        self.start = max(self.start, date(2026,7,1))
        self.end = min(self.end, date(2026,10,15))
        return self


def filters(program: str = '', start: date = date(2026,7,1), end: date = date(2026,10,15)):
    try:
        return Filters(program=program, start=start, end=end)
    except ValueError as e:
        raise HTTPException(422, str(e))


def where(f, column, alias='', program_column='program_id'):
    prefix = alias + '.' if alias else ''
    sql = f'CAST({prefix}{column} AS DATE) BETWEEN ? AND ?'
    params = [f.start.isoformat(), f.end.isoformat()]
    if f.program:
        sql += f' AND {prefix}{program_column} = ?'
        params.append(f.program)
    return sql, params


def overview(f):
    w,p = where(f,'created_at')
    stats = query(f'''SELECT count(*) interactions, round(avg(aht_minutes),2) aht, round(avg(csat_score),2) csat,
        round(100*avg(first_contact_resolved),2) fcr_pct, round(100*avg(sla_met),2) sla_pct,
        round(sum(service_cost_usd),2) cost_usd FROM interactions WHERE {w}''',p)[0]
    a,ap = where(f,'audit_at')
    qa = query(f'SELECT count(*) audits, round(avg(qa_score),2) qa_average, sum(critical_error) critical_errors FROM qa_audits WHERE {a}',ap)[0]
    stats.update(qa)
    stats['opportunities'] = query('SELECT count(*) n FROM opportunity_catalog')[0]['n']
    stats['source_entries'] = query('SELECT count(*) n FROM source_opportunities')[0]['n']
    stats['audit_coverage_pct'] = round(100 * qa['audits']/stats['interactions'],2) if stats['interactions'] else None
    # QA audits may occur after contact date; this is period-volume ratio, not linked coverage.
    stats['coverage_note'] = 'Audits dated in period / contacts dated in period. Audit records can refer to earlier contacts.'
    trend = query(f"SELECT strftime(CAST(created_at AS DATE), '%Y-%m-%d') date, count(*) contacts, round(avg(csat_score),2) csat FROM interactions WHERE {w} GROUP BY 1 ORDER BY 1",p)
    programs = query(f'''SELECT i.program_id, p.program_name, count(*) contacts, round(avg(i.aht_minutes),2) aht,
        round(100*avg(i.first_contact_resolved),1) fcr_pct FROM interactions i JOIN programs p USING(program_id)
        WHERE {where(f,'created_at','i')[0]} GROUP BY 1,2 ORDER BY contacts DESC''',p)
    return {'kpis':stats, 'trend':trend, 'programs':programs, 'filters':f.model_dump(mode='json')}


def opportunities(search='',department='',program='',complexity='',priority='',limit=50,offset=0):
    sql = '''SELECT o.*, count(DISTINCT s.source_id) source_count,
      min(a.implementation_weeks_assumed) fastest_weeks FROM opportunity_catalog o
      LEFT JOIN source_opportunities s USING(opportunity_id) LEFT JOIN solution_alternatives a USING(opportunity_id)
      WHERE (lower(o.opportunity_title || ' ' || o.primary_problem) LIKE ?)'''
    args = ['%'+search.lower()+'%']
    if department:
        sql += ' AND o.department = ?'
        args.append(department)
    if program:
        sql += " AND (s.program_context = (SELECT program_name FROM programs WHERE program_id=?) OR o.department IN ('Training','QA','HR'))"
        args.append(program)
    if complexity:
        sql += ' AND a.implementation_complexity = ?'
        args.append(complexity)
    # Priority is a transparent workflow classification, never a source fact.
    if priority:
        sql += ' AND o.department = ?'
        args.append({'Quality review':'QA','People workflows':'HR','Enablement':'Training'}.get(priority,priority))
    sql += ' GROUP BY ALL ORDER BY o.opportunity_id LIMIT ? OFFSET ?'
    return query(sql,args+[limit,offset])


def opportunity(oid):
    result = query('SELECT * FROM opportunity_catalog WHERE opportunity_id=?',[oid])
    if not result:
        raise HTTPException(404,'Opportunity not found')
    sources = query('SELECT * FROM source_opportunities WHERE opportunity_id=?',[oid])
    matches = {m['source_id']: m for m in get_status().get('source_matches', [])}
    for source in sources:
        source['workbook_original'] = matches.get(source['source_id'], {}).get('workbook')
    return {**result[0], 'sources':sources, 'alternatives':scenario_options(oid)}


def scenario_options(oid):
    return query('''SELECT a.*, s.* EXCLUDE(option_id) FROM solution_alternatives a
        JOIN scenario_estimates s USING(option_id) WHERE a.opportunity_id=? ORDER BY option_id''',[oid])


class ScenarioInputs(BaseModel):
    opportunity_id: str = Field(pattern=r'^OPP-\d{3}$')
    adoption_pct: float = Field(default=100,ge=0,le=100)
    hours: float | None = Field(default=None,ge=0,le=10000000)
    hourly_cost: float | None = Field(default=None,ge=0,le=10000)
    reduction_pct: float | None = Field(default=None,ge=0,le=100)
    case: str = Field(default='Base',pattern='^(Conservative|Base|Optimistic)$')
    max_weeks: int = Field(default=52, ge=1, le=104)


def compare(inputs):
    options = scenario_options(inputs.opportunity_id)
    factor = {'Conservative':.75,'Base':1,'Optimistic':1.2}[inputs.case]
    for o in options:
        hours = inputs.hours if inputs.hours is not None else o['annual_addressable_hours_assumed']
        hourly = inputs.hourly_cost if inputs.hourly_cost is not None else o['loaded_hourly_cost_usd_assumed']
        reduction = min(100,(inputs.reduction_pct if inputs.reduction_pct is not None else o['effort_reduction_pct_assumed'])*factor)
        gross = hours*hourly*(reduction/100)*(inputs.adoption_pct/100)
        cost = o['one_time_cost_usd_assumed']+12*o['monthly_operating_cost_usd_assumed']
        net = gross-cost
        o.update({'gross_annual_savings':round(gross,2),'first_year_cost':cost,'first_year_net_benefit':round(net,2),
          'roi_pct':round(100*net/cost,2) if cost else None,
          'recurring_year_net_benefit':round(gross-12*o['monthly_operating_cost_usd_assumed'],2),
          'parameters':{'annual_hours':hours,'hourly_cost_usd':hourly,'effort_reduction_pct':reduction,'adoption_pct':inputs.adoption_pct,'case_factor':factor},
          'eligible':o['implementation_weeks_assumed']<=inputs.max_weeks})
    eligible = [o for o in options if o['eligible']]
    best = max(eligible,key=lambda o:o['first_year_net_benefit'],default=None)
    return {'options':options,'recommended_option':best['option_id'] if best else None,
      'rationale':'Highest modeled first-year net benefit within the time constraint. A negative result is not an investment endorsement.',
      'assumptions':'Illustrative USD assumptions; full-year steady-state savings, no ramp or discounting. Alternatives overlap and must not be summed.', 'case':inputs.case}


def qa_summary(f):
    w,p = where(f,'audit_at','a')
    summary = query(f'''SELECT count(*) audit_count, round(avg(qa_score),2) qa_average,
      count(*) FILTER(WHERE critical_error=1) high_risk_count FROM qa_audits a WHERE {w}''',p)[0]
    cw,cp = where(f,'coaching_date')
    summary['coaching_queue'] = query(f"SELECT count(*) n FROM coaching_actions WHERE {cw} AND status <> 'Completed'",cp)[0]['n']
    summary['issues'] = query(f'SELECT finding_category AS name, count(*) AS value FROM qa_audits a WHERE {w} GROUP BY 1 ORDER BY 2 DESC',p)
    summary['by_program'] = query(f'''SELECT p.program_name AS name, count(*) audits, round(avg(a.qa_score),2) AS value
      FROM qa_audits a JOIN programs p USING(program_id) WHERE {w} GROUP BY 1 ORDER BY 1''',p)
    summary['trend'] = query(f"SELECT strftime(CAST(audit_at AS DATE),'%Y-%m-%d') date, round(avg(qa_score),2) score FROM qa_audits a WHERE {w} GROUP BY 1 ORDER BY 1",p)
    summary['coaching_status'] = query(f'SELECT status AS name,count(*) AS value FROM coaching_actions WHERE {cw} GROUP BY 1',cp)
    iw,ip = where(f,'created_at','i')
    coverage = query(f'''SELECT count(*) contacts, count(*) FILTER (WHERE EXISTS
      (SELECT 1 FROM qa_audits a WHERE a.interaction_id=i.interaction_id AND CAST(a.audit_at AS DATE) BETWEEN ? AND ?)) audited_contacts
      FROM interactions i WHERE {iw}''',[f.start.isoformat(),f.end.isoformat()]+ip)[0]
    summary['coverage'] = {**coverage,'pct':round(100*coverage['audited_contacts']/coverage['contacts'],2) if coverage['contacts'] else None,
      'definition':'Unique contacts created in period with an audit also dated in period / contacts created in period.'}
    return summary


def training_summary(f):
    w,p = where(f,'assigned_date','t')
    stats = query(f'''SELECT count(*) enrollments, count(*) FILTER(WHERE status='Completed' AND CAST(completion_date AS DATE)<=?) completed,
      round(avg(pre_assessment_score),2) pre_assessment,
      round(avg(post_assessment_score) FILTER(WHERE status='Completed' AND CAST(completion_date AS DATE)<=?),2) post_assessment
      FROM training_enrollments t WHERE {w}''',[f.end.isoformat(),f.end.isoformat()]+p)[0]
    stats['completion_pct'] = round(100*stats['completed']/stats['enrollments'],1) if stats['enrollments'] else None
    stats['courses'] = query(f'''SELECT c.course_id,c.name,c.topic,c.duration_hours,count(*) enrollments,
      count(*) FILTER(WHERE t.status='Completed' AND CAST(t.completion_date AS DATE)<=?) completed,
      round(avg(post_assessment_score) FILTER(WHERE t.status='Completed' AND CAST(t.completion_date AS DATE)<=?),1) assessment
      FROM training_enrollments t JOIN courses c USING(course_id) WHERE {w} GROUP BY 1,2,3,4 ORDER BY 2''',[f.end.isoformat(),f.end.isoformat()]+p)
    stats['trainers'] = query(f'''SELECT t.trainer_id,r.certification_level,r.location,r.facilitation_score,
      count(*) enrollments, round(avg(t.post_assessment_score) FILTER(WHERE t.status='Completed' AND CAST(t.completion_date AS DATE)<=?),1) mean_completed_assessment
      FROM training_enrollments t JOIN trainers r USING(trainer_id) WHERE {w} GROUP BY 1,2,3,4 ORDER BY 5 DESC''',[f.end.isoformat()]+p)
    # One first completed enrollment per employee avoids counting repeated audits across enrollments.
    stats['association'] = query(f'''WITH completed AS (
      SELECT employee_id,CAST(completion_date AS DATE) completed_on, row_number() OVER(PARTITION BY employee_id ORDER BY completion_date,enrollment_id) rn
      FROM training_enrollments t WHERE {w} AND status='Completed' AND CAST(completion_date AS DATE)<=?),
      pairs AS (SELECT c.employee_id,c.completed_on,
        avg(a.qa_score) FILTER(WHERE CAST(a.audit_at AS DATE)<c.completed_on) pre,
        avg(a.qa_score) FILTER(WHERE CAST(a.audit_at AS DATE)>c.completed_on) post,
        count(*) FILTER(WHERE CAST(a.audit_at AS DATE)<c.completed_on) pre_n,
        count(*) FILTER(WHERE CAST(a.audit_at AS DATE)>c.completed_on) post_n
        FROM completed c JOIN qa_audits a ON c.employee_id=a.employee_id
        AND CAST(a.audit_at AS DATE) BETWEEN greatest(c.completed_on-INTERVAL 30 DAY,CAST(? AS DATE)) AND least(c.completed_on+INTERVAL 30 DAY,CAST(? AS DATE))
        WHERE c.rn=1 GROUP BY 1,2)
      SELECT count(*) employees,round(avg(pre),2) before_qa,round(avg(post),2) after_qa,sum(pre_n) before_audits,sum(post_n) after_audits
      FROM pairs WHERE pre_n>0 AND post_n>0''',p+[f.end.isoformat(),f.start.isoformat(),f.end.isoformat()])[0]
    stats['association']['method'] = 'First completed enrollment per employee assigned in period; paired employees with audits on both sides; 30 days before/after completion, clipped to reporting window, excluding completion day. Employee-weighted means. Other training and selection effects are uncontrolled. Association, not causation.'
    return stats


def hr_summary(f,role):
    # Onboarding is a current snapshot, intentionally not misleadingly filtered by historical hire date.
    clause = 'WHERE e.program_id=?' if f.program else ''
    args = [f.program] if f.program else []
    stats = query(f'''SELECT count(*) employees,
      sum(document_checklist_total-document_checklist_received) missing_documents,
      count(*) FILTER(WHERE identity_verification_status<>'Verified') verification_pending,
      count(*) FILTER(WHERE policy_ack_status<>'Signed') policy_pending,
      count(*) FILTER(WHERE workstation_access_status<>'Provisioned') access_pending
      FROM hr_onboarding h JOIN employees e USING(employee_id) {clause}''',args)[0]
    stats['scope_note'] = 'Onboarding is the full imported snapshot (all hire dates), scoped by program. Cases and recognitions use reporting dates.'
    rw,rp = where(f,'date','r',program_column='program_id')
    stats['recognitions'] = query(f'''SELECT recognition_type AS name,count(*) AS value FROM employee_recognitions r JOIN employees e USING(employee_id)
      WHERE {rw.replace('r.program_id','e.program_id')} GROUP BY 1''',rp)
    stats['case_access'] = role == 'HR Manager'
    if role == 'HR Manager':
        cw,cp = where(f,'opened_date','h')
        cw = cw.replace('h.program_id','e.program_id')
        stats['cases'] = query(f'''SELECT h.case_id, 'Masked employee' employee, h.case_type,h.case_status,h.hr_approval_status,
          h.hearing_required,h.employee_acknowledged FROM hr_cases h JOIN employees e USING(employee_id)
          WHERE {cw} ORDER BY opened_date DESC LIMIT 100''',cp)
        stats['case_summary'] = query(f'''SELECT case_status AS name,count(*) AS value FROM hr_cases h JOIN employees e USING(employee_id) WHERE {cw} GROUP BY 1''',cp)
        stats['onboarding'] = query(f'''SELECT h.onboarding_id,'Masked employee' employee,h.document_checklist_received,h.document_checklist_total,
          h.identity_verification_status,h.policy_ack_status,h.workstation_access_status
          FROM hr_onboarding h JOIN employees e USING(employee_id) {clause} LIMIT 240''',args)
    else:
        stats['cases'] = []
        stats['onboarding'] = []
        stats['case_summary'] = []
    stats['review_gate'] = 'HR drafts require human approval. No personnel decision or operational record is changed by this application.'
    return stats


def operations_summary(f):
    w,p=where(f,'created_at','i')
    sales=query(f'''SELECT count(*) leads, count(*) FILTER(WHERE l.sale_completed=1) completed_sales,
      count(*) FILTER(WHERE l.requires_verification=1) verification_required,
      count(*) FILTER(WHERE l.requires_verification=1 AND l.verification_status<>'Verified') verification_not_verified,
      round(avg(l.lead_score),2) mean_lead_score, round(sum(l.revenue_usd),2) synthetic_revenue_usd,
      count(*) FILTER(WHERE l.consent_captured=1) consent_captured
      FROM sales_leads l JOIN interactions i USING(interaction_id) WHERE {w}''',p)[0]
    tickets=query(f'''SELECT count(*) tickets, round(avg(t.resolution_hours),2) mean_resolution_hours,
      count(*) FILTER(WHERE t.escalation_required=1) escalations
      FROM tickets t JOIN interactions i USING(interaction_id) WHERE {w}''',p)[0]
    issues=query(f'''SELECT i.issue_category, count(*) contacts, round(avg(i.aht_minutes),2) mean_aht_minutes,
      round(100*avg(i.first_contact_resolved),2) fcr_pct FROM interactions i WHERE {w}
      GROUP BY 1 ORDER BY contacts DESC''',p)
    return {'sales':sales,'tickets':tickets,'issues':issues,
      'definition':'Sales leads and tickets linked to contacts created within the reporting scope. Verification queue is required records whose source status is not Verified. Revenue is synthetic USD, not forecast savings.'}
