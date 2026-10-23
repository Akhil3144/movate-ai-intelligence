"""Local, deterministic agent demos. No model, network, operational writes or new source data."""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException
from pydantic import BaseModel, Field
from . import analytics as a, storage
from .data import query

MODE = 'AI Agent Demo — Rules-Based'

# Names/objectives describe implementations of the inspected source records, not new requirements.
SPECS = {
    'OPP-001': dict(name='Training Reporting Agent', objective='Consolidate training participation, completion and assessment results into one local report.', tables=['training_enrollments','courses','trainers','qa_audits'], capabilities=['Consolidated training KPIs','Course completion reporting','QA context'], workflow=['Scope assigned enrollments and completions by reporting period.','Join course and trainer records to enrollment outcomes.','Compile a consolidated summary and flag incomplete course cohorts.']),
    'OPP-002': dict(name='Training Effectiveness Agent', objective='Connect completed training with subsequent QA using valid employee and date links.', tables=['training_enrollments','qa_audits','courses'], capabilities=['Paired employee analysis','Before/after QA windows','Sample-size disclosure'], workflow=['Select the first completed enrollment per employee in scope.','Pair audits before and after completion within clipped 30-day windows.','Compare employee-weighted means and disclose confounding and sample sizes.']),
    'OPP-003': dict(name='Trainer Performance Agent', objective='Summarize trainer-linked learning outcomes and source capability indicators for content and enablement review.', tables=['trainers','training_enrollments','courses'], capabilities=['Trainer scorecards','Certification visibility','Playbook adoption review'], workflow=['Join trainers to scoped assigned enrollments.','Aggregate completed assessments and source capability indicators.','Identify playbook-enablement review priorities without rating employee suitability.']),
    'OPP-004': dict(name='Customer Support Agent', objective='Find repeated support issues, handling effort and resolution friction to guide knowledge-based assistance.', tables=['interactions','tickets','knowledge_articles'], capabilities=['Repeat-issue analysis','Resolution and escalation review','Knowledge coverage'], workflow=['Scope contacts to the original program context unless overridden.','Join tickets by interaction and summarize categories and channels.','Match issue categories to knowledge articles and propose a limited support pilot.']),
    'OPP-005': dict(name='Sales Lead Optimization Agent', objective='Analyze lead-score bands, conversion outcomes and verification/consent exceptions for a reviewed follow-up process.', tables=['sales_leads','interactions'], capabilities=['Lead-score bands','Conversion denominators','Consent and verification exceptions'], workflow=['Link sales leads to contacts in the selected period and program.','Group source scores into declared review bands and calculate observed conversion.','Flag workflow exceptions for human review; draft a consent-led pilot.']),
    'OPP-006': dict(name='Product Troubleshooting Agent', objective='Identify complex troubleshooting categories and pair them with existing guided-resolution knowledge.', tables=['interactions','tickets','knowledge_articles'], capabilities=['Complexity breakdown','Unresolved issue analysis','Guided-resolution drafts'], workflow=['Select contacts in the original product-support program context.','Summarize complex, unresolved and escalated issues.','Retrieve matching knowledge guidance and draft reviewed troubleshooting steps.']),
    'OPP-007': dict(name='Self-Service & Demand Triage Agent', objective='Identify contact peaks and source-flagged self-service candidates for a reviewed triage pilot.', tables=['interactions','daily_program_kpis','knowledge_articles'], capabilities=['Daily demand analysis','Eligibility flag aggregation','Self-service coverage'], workflow=['Recompute daily volume and campaign-peak counts from contacts.','Group self-service-eligible contacts by issue category.','Compare the supplied daily totals and retrieve available knowledge for a pilot.']),
    'OPP-008': dict(name='QA Reporting Automation Agent', objective='Consolidate audits, quality exceptions and coaching status into one consistent local quality report.', tables=['qa_audits','coaching_actions','interactions'], capabilities=['Unified QA summary','Critical-error analysis','Coaching queue consolidation'], workflow=['Scope audit records and calculate sample coverage.','Group findings and critical errors using source flags.','Consolidate dated coaching actions and identify review priorities.']),
    'OPP-009': dict(name='Sales Quality Verification Agent', objective='Review completed-sale verification and linked audit coverage to demonstrate an AQM readiness workflow.', tables=['sales_leads','interactions','qa_audits'], capabilities=['Completed-sale checks','Verification workflow queues','Linked audit coverage'], workflow=['Select completed-sale leads in the reporting scope.','Inspect required verification, source status and consent flags.','Link audited interactions and prepare a human-reviewed verification checklist.']),
    'OPP-010': dict(name='QA Workflow Integration Agent', objective='Reconcile audit-platform records, acknowledgements and linked coaching queues without changing source systems.', tables=['qa_audits','coaching_actions'], capabilities=['Platform consolidation','Acknowledgement gaps','Audit-to-coaching reconciliation'], workflow=['Group scoped audits by their actual audit-platform labels.','Link coaching records to the same audit cohort.','Flag unacknowledged audits and review-ready workflow exceptions.']),
    'OPP-011': dict(name='HR Disciplinary Workflow Agent', objective='Prepare masked process checklists for acknowledgement, hearings and HR approval; leave every personnel decision to a human.', tables=['hr_cases','employees'], capabilities=['Masked workflow queues','Approval-gap checks','Review-only process drafts'], workflow=['Enforce the HR Manager persona before querying restricted cases.','Aggregate approval, hearing and acknowledgement flags.','Draft a process checklist requiring authorized human review; issue nothing.']),
    'OPP-012': dict(name='HR Onboarding Agent', objective='Detect missing documents and incomplete verification, acknowledgement and access steps in the imported onboarding snapshot.', tables=['hr_onboarding','employees'], capabilities=['Missing-document detection','Incomplete-stage checks','Reviewed onboarding checklist'], workflow=['Scope the imported employee/onboarding snapshot by program.','Compare required and received documents and inspect actual stage statuses.','Compile a masked checklist for authorized HR review and disclose missing timing data.']),
    'OPP-013': dict(name='Employee Engagement Agent', objective='Consolidate recognition participation, points and channels to guide a reviewed engagement workflow.', tables=['employee_recognitions','employees'], capabilities=['Recognition participation','Points aggregation','Channel and visibility reporting'], workflow=['Scope recognition events by date and employee program.','Aggregate recognition types, channels, visibility and points.','Identify participation gaps at aggregate level and draft an engagement-process pilot.']),
}


class RunRequest(BaseModel):
    filters: a.Filters = Field(default_factory=a.Filters)


def definition(oid):
    original = a.opportunity(oid)
    if oid not in SPECS:
        raise HTTPException(404, 'No rules-based workflow is registered for this opportunity')
    return {**original, 'agent': {**SPECS[oid], 'mode': MODE}, 'original_problem': original['primary_problem']}


def catalog(search='', department='', program='', complexity='', priority='', limit=50, offset=0):
    # Apply existing source filters, then agent-name/capability search before pagination.
    rows = a.opportunities(department=department, program=program, complexity=complexity, priority=priority, limit=100)
    found = []
    for row in rows:
        spec = SPECS.get(row['opportunity_id'])
        if not spec:
            continue
        text = ' '.join([row['opportunity_title'],row['primary_problem'],spec['name'],spec['objective'],*spec['capabilities']])
        if search.lower() in text.lower():
            found.append({**row, 'agent': {**spec, 'mode': MODE}})
    return found[offset:offset+limit]


def effective_scope(d, requested):
    scope = requested.model_copy(deep=True)
    contexts = {s['program_context'] for s in d['sources']}
    if d['opportunity_id'] == 'OPP-009':
        contexts = {'SXM Outbound'}  # The original title/problem explicitly specifies SXM.
    source_programs = query('SELECT program_id,program_name FROM programs')
    original = next((p for p in source_programs if p['program_name'] in contexts), None)
    note = 'Uses the selected global reporting scope.'
    if not scope.program and original:
        scope.program = original['program_id']
        note = f"Uses {original['program_name']}, the original requirement's program context, because All programs is selected."
    elif original and scope.program != original['program_id']:
        note = f"The selected program overrides the original {original['program_name']} context. This does not imply the worksheet requirement was authored for the selected program."
    name = next((p['program_name'] for p in source_programs if p['program_id'] == scope.program), 'All programs' if not scope.program else scope.program)
    return scope, name, note


def metric(label,value,unit='records',definition=''):
    return dict(label=label,value=value,unit=unit,definition=definition)


def table(title, rows, columns, source_tables, method):
    return dict(title=title,rows=rows,columns=[{'key':key,'label':label} for key,label in columns],source_tables=source_tables,method=method,kind='Observed synthetic data')


def result(metrics, findings, tables, actions, limitations, method):
    return dict(metrics=metrics,findings=findings,tables=tables,recommended_actions=actions,limitations=limitations,method=method,status='completed')


def _reporting(f, role):
    d = a.training_summary(f)
    w,p = a.where(f,'audit_at')
    qa = query(f'SELECT count(*) audits, round(avg(qa_score),2) mean_score FROM qa_audits WHERE {w}',p)[0]
    return result([metric('Assigned enrollments',d['enrollments']),metric('Completed by period end',d['completed']),metric('Completion rate',d['completion_pct'],'percent'),metric('Completed assessment mean',d['post_assessment'],'score / 100')],
      [f"Consolidated {d['enrollments']} assigned enrollments across {len(d['courses'])} courses and {len(d['trainers'])} trainers.",f"{d['completed']} enrollments were completed by the end date. QA context contains {qa['audits']} audits with mean score {qa['mean_score']}. The QA cohort is not identical to the training cohort."],
      [table('Consolidated course report',d['courses'],[('course_id','Course ID'),('name','Course'),('enrollments','Assigned'),('completed','Completed'),('assessment','Completed assessment mean')],['training_enrollments','courses'],'Assignments in period; completions and post-assessments restricted to completion by period end.')],
      ['Review courses with incomplete enrollments with their process owners.','Use the consolidated report as a reviewed reporting draft; agree a consistent completion definition.'],
      ['Live LMS/HRIS ingestion, scheduled BI delivery and predictive trainee-risk models are not connected. This demo consolidates local records on demand.','No reporting-effort timestamps are supplied; manual effort savings cannot be measured.'],
      'Enrollment counts are scoped by assigned_date and program. Completed means source status Completed and completion_date no later than reporting end.')


def _effectiveness(f, role):
    d=a.training_summary(f); pair=d['association']
    difference=round(pair['after_qa']-pair['before_qa'],2) if pair['after_qa'] is not None and pair['before_qa'] is not None else None
    rows=[{'period':'Before completion','score':pair['before_qa'],'audits':pair['before_audits']},{'period':'After completion','score':pair['after_qa'],'audits':pair['after_audits']}]
    return result([metric('Paired employees',pair['employees'],'employees'),metric('Before QA mean',pair['before_qa'],'score / 100'),metric('After QA mean',pair['after_qa'],'score / 100'),metric('Observed QA difference',difference,'points')],
      [f"The paired sample includes {pair['employees']} employees, {pair['before_audits'] or 0} before audits and {pair['after_audits'] or 0} after audits.", 'No causal improvement is established by this comparison. Other training and selection effects are uncontrolled.' if pair['employees'] else 'No employees have audits on both sides in this scope; widen the period or supply additional dated audits.'],
      [table('Temporally paired QA comparison',rows,[('period','Period'),('score','Employee-weighted QA mean'),('audits','Audits')],['training_enrollments','qa_audits'],pair['method'])],
      ['Review the paired sample and course content with the training owner.','Plan a controlled pilot with comparable pre/post measures before attributing benefits to training.'],
      ['Independent synthetic training events and uncontrolled confounding prevent causal claims. No predictive learner model is run.'],pair['method'])


def _trainers(f, role):
    w,p=a.where(f,'assigned_date','t')
    rows=query(f'''SELECT r.trainer_id,r.location,r.certification_level,r.facilitation_score,r.digital_playbook_adoption_pct,
      count(*) enrollments, count(*) FILTER(WHERE t.status='Completed' AND t.completion_date<=?) completed,
      round(avg(t.post_assessment_score) FILTER(WHERE t.status='Completed' AND t.completion_date<=?),2) assessment_mean
      FROM training_enrollments t JOIN trainers r USING(trainer_id) WHERE {w}
      GROUP BY 1,2,3,4,5 ORDER BY r.digital_playbook_adoption_pct,r.trainer_id''',[f.end.isoformat(),f.end.isoformat()]+p)
    # All thresholds below are demo review rules, not source requirements or personnel scores.
    review=[r for r in rows if r['digital_playbook_adoption_pct']<80]
    enrollments=sum(r['enrollments'] for r in rows)
    return result([metric('Trainers with assignments',len(rows),'trainers'),metric('Linked enrollments',enrollments),metric('Playbook review candidates',len(review),'trainers')],
      [f"{len(rows)} trainers have assignments in this scope; {len(review)} have source playbook adoption below the declared 80% demo review threshold.",'Assessment means reflect completed enrollments, not a causal or adjusted measure of trainer effectiveness.'],
      [table('Trainer enablement scorecards',rows,[('trainer_id','Trainer ID'),('certification_level','Source certification'),('enrollments','Enrollments'),('completed','Completed'),('assessment_mean','Completed assessment mean'),('digital_playbook_adoption_pct','Source playbook adoption %'),('facilitation_score','Source facilitation score')],['trainers','training_enrollments'],'Join trainer_id; assignments in period, completed assessments by reporting end. Source capability indicators are not computed performance ratings.')],
      ['Offer a playbook walkthrough to the trainers flagged for process enablement; do not make personnel judgments.','Review facilitator guides and assessment comparability with the training manager.'],
      ['80% playbook adoption is an explicit demo review rule, not an original worksheet target.','Speech/delivery analysis, certification issuance and train-the-trainer integrations are not implemented; no audio is available.'],
      'Trainer-level counts and completed-assessment means are calculated from linked enrollments. No ranking of employment suitability or causal trainer impact is produced.')


def _support(f, role):
    w,p=a.where(f,'created_at','i')
    rows=query(f'''SELECT i.issue_category,count(*) contacts,round(avg(i.aht_minutes),2) mean_aht_minutes,
      count(*) FILTER(WHERE i.first_contact_resolved=0) unresolved_contacts,
      round(avg(t.resolution_hours),2) mean_resolution_hours,
      count(*) FILTER(WHERE t.escalation_required=1) escalations,
      (SELECT count(*) FROM knowledge_articles k WHERE k.program_id=i.program_id AND k.issue_category=i.issue_category) knowledge_articles
      FROM interactions i JOIN tickets t USING(interaction_id) WHERE {w} GROUP BY i.program_id,i.issue_category ORDER BY contacts DESC,i.issue_category''',p)
    channels=query(f'SELECT channel,count(*) contacts,round(avg(aht_minutes),2) mean_aht_minutes FROM interactions i WHERE {w} GROUP BY channel ORDER BY contacts DESC',p)
    n=sum(r['contacts'] for r in rows); unresolved=sum(r['unresolved_contacts'] for r in rows)
    return result([metric('Linked support contacts',n),metric('Not resolved on first contact',unresolved),metric('Issue groups',len(rows),'groups'),metric('Groups without knowledge articles',sum(r['knowledge_articles']==0 for r in rows),'groups')],
      [f"{n} contacts are linked to ticket records. {unresolved} are not first-contact resolved.",f"The largest issue group is {rows[0]['issue_category']} with {rows[0]['contacts']} contacts." if rows else 'No linked contacts in scope.'],
      [table('Repeated support issues',rows,[('issue_category','Issue category'),('contacts','Contacts'),('mean_aht_minutes','AHT · min'),('unresolved_contacts','Not FCR'),('mean_resolution_hours','Resolution · hours'),('escalations','Escalations'),('knowledge_articles','Matching KB articles')],['interactions','tickets','knowledge_articles'],'Ticket join by interaction_id; knowledge matches by program_id and issue_category.'),table('Contact channels',channels,[('channel','Channel'),('contacts','Contacts'),('mean_aht_minutes','AHT · min')],['interactions'],'Counts by source channel; records do not establish cross-channel identity resolution.')],
      ['Review the highest-volume unresolved categories with the support owner.','Pilot a reviewed knowledge guide for repeated questions and measure FCR and handling time.'],
      ['CRM integration, live chatbot conversations, identity resolution and predictive volume forecasting are not connected. This is a local analytical support simulation.'],
      'Contacts created in period, grouped by issue category; ticket resolution hours are source values and do not prove process causes.')


def _sales(f, role):
    w,p=a.where(f,'created_at','i')
    rows=query(f'''SELECT CASE WHEN l.lead_score<40 THEN 'Below 40' WHEN l.lead_score<70 THEN '40–69' ELSE '70 and above' END score_band,
      count(*) leads,sum(l.sale_completed) completed_sales,round(100*avg(l.sale_completed),2) conversion_pct,
      count(*) FILTER(WHERE l.consent_captured=0) consent_not_captured,
      count(*) FILTER(WHERE l.requires_verification=1 AND l.verification_status<>'Verified') verification_queue
      FROM sales_leads l JOIN interactions i USING(interaction_id) WHERE {w} GROUP BY 1 ORDER BY 1''',p)
    leads=sum(r['leads'] for r in rows); sold=sum(r['completed_sales'] for r in rows)
    return result([metric('Linked sales leads',leads),metric('Completed sales',sold),metric('Observed conversion',round(100*sold/leads,2) if leads else None,'percent'),metric('Consent flag not captured',sum(r['consent_not_captured'] for r in rows))],
      [f"{sold} of {leads} source leads are marked sale_completed. Source lead scores are grouped for review; no new predictive score is generated.",f"{sum(r['verification_queue'] for r in rows)} required verifications are not marked Verified."],
      [table('Observed conversion by declared score band',rows,[('score_band','Source score band'),('leads','Leads'),('completed_sales','Completed sales'),('conversion_pct','Observed conversion %'),('consent_not_captured','Consent flag absent'),('verification_queue','Required verification queue')],['sales_leads','interactions'],'Contact-date scope; demo bands below 40 / 40–69 / 70+ use the existing lead_score field. Conversion denominator is leads per band.')],
      ['Validate consent and verification requirements with the process owner before considering any follow-up.','Use observed band outcomes to design a reviewed targeting/script pilot; obtain outcome and script-version data before judging script effectiveness.'],
      ['Score-band cutoffs are declared demo grouping assumptions, not validated predictive thresholds.','No call transcripts, script versions, dialer events or follow-up system are supplied. Speech analytics, dialing and messaging are simulations only; nothing is sent.'],
      'Deterministic source-score bands and observed sale_completed proportions. Associations do not show that score, script or targeting caused conversion.')


def _troubleshooting(f, role):
    w,p=a.where(f,'created_at','i')
    rows=query(f'''SELECT i.issue_category,i.complexity,count(*) contacts,
      count(*) FILTER(WHERE i.first_contact_resolved=0) not_first_contact_resolved,
      round(avg(i.aht_minutes),2) mean_aht_minutes,sum(t.escalation_required) escalations
      FROM interactions i JOIN tickets t USING(interaction_id) WHERE {w} GROUP BY 1,2
      ORDER BY not_first_contact_resolved DESC,contacts DESC,i.issue_category,i.complexity''',p)
    articles=query('SELECT article_id,issue_category,title,article_summary,review_status FROM knowledge_articles WHERE (?=\'\' OR program_id=?) ORDER BY article_id',[f.program,f.program])
    n=sum(r['contacts'] for r in rows); high=sum(r['contacts'] for r in rows if r['complexity']=='High')
    return result([metric('Troubleshooting contacts',n),metric('High-complexity contacts',high),metric('Not first-contact resolved',sum(r['not_first_contact_resolved'] for r in rows)),metric('Available source guides',len(articles),'articles')],
      [f"{high} of {n} contacts are source-labeled High complexity.",f"Highest unresolved category/complexity group: {rows[0]['issue_category']} / {rows[0]['complexity']} ({rows[0]['not_first_contact_resolved']} contacts)." if rows else 'No troubleshooting contacts match this scope.'],
      [table('Troubleshooting review queue',rows,[('issue_category','Issue category'),('complexity','Source complexity'),('contacts','Contacts'),('not_first_contact_resolved','Not FCR'),('mean_aht_minutes','AHT · min'),('escalations','Escalations')],['interactions','tickets'],'Contact-created scope; priorities ordered by unresolved count, not inferred misuse.'),table('Source guided-resolution articles',articles,[('article_id','Article ID'),('issue_category','Issue'),('title','Title'),('article_summary','Original guidance'),('review_status','Source review status')],['knowledge_articles'],'Program-matched original knowledge guidance, not newly generated product instructions.')],
      ['Have the product owner review guides for the largest unresolved category before publishing.','Pilot the approved guide with an explicit escalation step and monitor handling time and first-contact resolution.'],
      ['Product telemetry, return/misuse reasons and live in-app onboarding are unavailable. The synthetic records do not establish that misuse caused returns.','No guide is published and no customer chatbot or in-app integration is invoked.'],
      'Aggregate source complexity and outcome flags. Guidance is retrieved verbatim from the program knowledge table; product safety/compliance review remains human-led.')


def _selfservice(f, role):
    w,p=a.where(f,'created_at','i')
    daily=query(f'SELECT CAST(created_at AS DATE) date,count(*) contacts,sum(is_campaign_peak) campaign_peak_contacts FROM interactions i WHERE {w} GROUP BY 1 ORDER BY 1',p)
    groups=query(f'''SELECT i.issue_category,count(*) contacts,sum(i.self_service_eligible) eligible_contacts,
      count(*) FILTER(WHERE self_service_eligible=1 AND EXISTS (SELECT 1 FROM knowledge_articles k WHERE k.article_id=i.knowledge_article_id AND k.program_id=i.program_id)) eligible_with_linked_article
      FROM interactions i WHERE {w} GROUP BY 1 ORDER BY eligible_contacts DESC,i.issue_category''',p)
    kw,kp=a.where(f,'date')
    supplied=query(f'SELECT coalesce(sum(contacts),0) contacts FROM daily_program_kpis WHERE {kw}',kp)[0]['contacts']
    n=sum(r['contacts'] for r in daily); eligible=sum(r['eligible_contacts'] for r in groups)
    return result([metric('Contacts in period',n),metric('Source-flagged eligible',eligible),metric('Campaign-peak contacts',sum(r['campaign_peak_contacts'] for r in daily)),metric('Highest observed daily volume',max((r['contacts'] for r in daily),default=0),'contacts / day')],
      [f"{eligible} of {n} contacts carry the source self_service_eligible flag. This is not a demonstrated deflection rate.",f"Recomputed contact total {n}; supplied daily KPI total {supplied}. A difference would require reconciliation before a pilot."],
      [table('Self-service candidate categories',groups,[('issue_category','Issue category'),('contacts','Contacts'),('eligible_contacts','Source eligible'),('eligible_with_linked_article','Eligible with linked article')],['interactions','knowledge_articles'],'Eligibility uses only source flags; a non-null article ID is a validated link, not proof that the article resolves the request.'),table('Observed daily demand',daily,[('date','Date'),('contacts','Contacts'),('campaign_peak_contacts','Campaign-peak contacts')],['interactions','daily_program_kpis'],'Daily volume recomputed from source contacts; compared to supplied daily totals.')],
      ['Review knowledge coverage and escalation paths for the largest eligible categories.','Pilot a self-service guide and measure actual completion/deflection before making savings claims.'],
      ['Live portal, AI triage, community support and real-time ingestion are not connected. No future demand is forecast.','self_service_eligible and is_campaign_peak are synthetic input flags, not model predictions.'],
      'Group contacts by date and issue category. No new peak threshold or deflection assumption is presented as observed data.')


def _qa_reporting(f, role):
    d=a.qa_summary(f)
    return result([metric('Audits in period',d['audit_count']),metric('Mean QA score',d['qa_average'],'score / 100'),metric('Critical-error audits',d['high_risk_count']),metric('Open dated coaching',d['coaching_queue'])],
      [f"The consolidated report contains {d['audit_count']} audits and {d['high_risk_count']} source critical-error flags.",f"Linked contact coverage is {d['coverage']['audited_contacts']} of {d['coverage']['contacts']} contacts ({d['coverage']['pct']}%). This is an audited subset, not automatic full coverage."],
      [table('Consolidated audit findings',d['issues'],[('name','Finding category'),('value','Audits')],['qa_audits'],'All scoped audits grouped by original finding_category.'),table('Dated coaching tracker',d['coaching_status'],[('name','Source coaching status'),('value','Actions')],['coaching_actions'],'Coaching_date in reporting scope; this is a dated action cohort, distinct from the audit cohort.')],
      ['Agree shared metric definitions and review critical-error findings with the QA manager.','Reconcile the open coaching queue and obtain human approval for quality/compliance actions.'],
      ['External hygiene/red-flag trackers and manual reporting-effort logs are not supplied. RPA and BI-system writes are not executed.'],d['coverage']['definition'])


def _verification(f, role):
    w,p=a.where(f,'created_at','i')
    rows=query(f'''SELECT l.verification_status,count(*) completed_sales,
      count(*) FILTER(WHERE l.requires_verification=1) verification_required,
      count(*) FILTER(WHERE l.consent_captured=0) consent_not_captured,
      count(*) FILTER(WHERE EXISTS (SELECT 1 FROM qa_audits q WHERE q.interaction_id=i.interaction_id
        AND CAST(q.audit_at AS DATE) BETWEEN ? AND ?)) audited_sales
      FROM sales_leads l JOIN interactions i USING(interaction_id) WHERE {w} AND l.sale_completed=1
      GROUP BY 1 ORDER BY 1''',[f.start.isoformat(),f.end.isoformat()]+p)
    n=sum(r['completed_sales'] for r in rows); audited=sum(r['audited_sales'] for r in rows)
    pending=sum(r['verification_required'] for r in rows if r['verification_status']!='Verified')
    return result([metric('Completed-sale leads',n),metric('Required but not Verified',pending),metric('Completed sales with audit',audited),metric('Linked audit coverage',round(100*audited/n,2) if n else None,'percent')],
      [f"{audited} of {n} completed-sale leads link to an audit dated within this reporting period; {pending} required verifications are not marked Verified.",'The worksheet statement about verifier headcount is an original proposal context, not an observed headcount metric in these records.'],
      [table('Completed-sale verification workflow',rows,[('verification_status','Source verification status'),('completed_sales','Completed-sale leads'),('verification_required','Verification required'),('audited_sales','With dated QA audit'),('consent_not_captured','Consent flag absent')],['sales_leads','interactions','qa_audits'],'Completed-sale denominator; audits counted by EXISTS to prevent duplicate-counting sale leads.')],
      ['Route outstanding required verification to the authorized QA reviewer.','Review an AQM pilot with human sign-off, consent controls and independently validated coverage/accuracy before changing verifier staffing.'],
      ['No call audio, transcripts, speech models or automated verification integrations are provided. This is an AQM workflow simulation; it demonstrates no speech-model accuracy or staffing savings.'],
      'Only completed-sale source leads are counted. Required verification status and actual linked audit existence are distinct checks.')


def _qa_workflow(f, role):
    w,p=a.where(f,'audit_at','q')
    rows=query(f'''SELECT q.audit_platform,count(*) audits,
      count(*) FILTER(WHERE q.acknowledgement_status<>'Acknowledged') acknowledgement_pending,
      count(*) FILTER(WHERE q.qa_score<85) below_85,
      count(*) FILTER(WHERE q.qa_score<85 AND NOT EXISTS(SELECT 1 FROM coaching_actions c WHERE c.audit_id=q.audit_id AND c.coaching_date<=?)) below_85_without_coaching
      FROM qa_audits q WHERE {w} GROUP BY 1 ORDER BY audits DESC,q.audit_platform''',[f.end.isoformat()]+p)
    coaching=query(f'''SELECT c.status,count(*) actions,count(*) FILTER(WHERE c.acknowledged=0) unacknowledged_actions
      FROM coaching_actions c JOIN qa_audits q USING(audit_id) WHERE {w} AND c.coaching_date<=? GROUP BY c.status ORDER BY c.status''',p+[f.end.isoformat()])
    return result([metric('Audit platforms',len(rows),'platforms'),metric('Audits in cohort',sum(r['audits'] for r in rows)),metric('Audit acknowledgements pending',sum(r['acknowledgement_pending'] for r in rows)),metric('Below-85 audits without coaching by end',sum(r['below_85_without_coaching'] for r in rows))],
      [f"{len(rows)} source platform labels occur in the selected audit cohort. Coaching joins remain tied to those same audit IDs.",'An acknowledgement exception is a workflow-review item, not evidence of employee misconduct.'],
      [table('Audit platform reconciliation',rows,[('audit_platform','Source platform'),('audits','Audits'),('acknowledgement_pending','Not Acknowledged'),('below_85','Below 85'),('below_85_without_coaching','Below 85 without coaching by end')],['qa_audits','coaching_actions'],'Below-85 is the dataset README coaching-generation rule. Pending means source acknowledgement_status is not Acknowledged.'),table('Coaching linked to audit cohort',coaching,[('status','Coaching status'),('actions','Actions'),('unacknowledged_actions','Unacknowledged')],['qa_audits','coaching_actions'],'Only coaching linked to scoped audits and dated no later than reporting end; no fanout to platform totals.')],
      ['Review audit acknowledgements and missing coaching links with the QA owner.','Pilot a unified workflow with named approvers and audit trails before changing any platform.'],
      ['Audit upload latency, modification-approval emails and platform API connectivity are unavailable. No migration, acknowledgement or score modification is performed.'],
      'Aggregate platform labels from audits and use existence checks for coaching gaps. No external platform is contacted.')


def _disciplinary(f, role):
    if role!='HR Manager':
        return {**result([],['Restricted workflow: switch to HR Manager to run masked case analysis. No restricted case records were queried.'],[],['Ask the authorized HR Manager to review the process checklist.'],['HR Manager access and human approval are required; no disciplinary decision or form issuance is automated.'],'Role enforcement occurs before the restricted query.'),'status':'restricted'}
    w,p=a.where(f,'opened_date','h');w=w.replace('h.program_id','e.program_id')
    rows=query(f'''SELECT h.case_status,h.hr_approval_status,count(*) cases,
      sum(h.hearing_required) hearings_required,
      count(*) FILTER(WHERE h.employee_acknowledged=0) acknowledgement_pending
      FROM hr_cases h JOIN employees e USING(employee_id) WHERE {w} GROUP BY 1,2 ORDER BY 1,2''',p)
    masked=query(f'''SELECT h.case_id,'Masked employee' employee,h.case_status,h.hr_approval_status,h.hearing_required,h.employee_acknowledged
      FROM hr_cases h JOIN employees e USING(employee_id) WHERE {w} ORDER BY h.opened_date,h.case_id LIMIT 20''',p)
    n=sum(r['cases'] for r in rows); pending=sum(r['cases'] for r in rows if r['hr_approval_status']!='Approved')
    return result([metric('Cases in period',n),metric('Approval not recorded as Approved',pending),metric('Hearing-required flags',sum(r['hearings_required'] for r in rows)),metric('Acknowledgements pending',sum(r['acknowledgement_pending'] for r in rows))],
      [f"{pending} of {n} source cases are not marked HR Approved. Hearing flags specify a requirement, not proof that a hearing was held.",'Review-only draft: confirm authorized case ownership → review facts and policy → arrange any required hearing → record human approval → obtain acknowledgement through the approved process.'],
      [table('HR process checkpoints',rows,[('case_status','Source stage'),('hr_approval_status','HR approval'),('cases','Cases'),('hearings_required','Hearing required'),('acknowledgement_pending','Acknowledgement pending')],['hr_cases','employees'],'opened_date and program scoped; aggregate process flags only.'),table('Masked review records · first 20',masked,[('case_id','Case ID'),('employee','Employee'),('case_status','Source stage'),('hr_approval_status','HR approval'),('hearing_required','Hearing required'),('employee_acknowledged','Acknowledged')],['hr_cases'],'No employee identity or case severity/type is returned.')],
      ['Have an authorized HR reviewer verify each required approval and hearing step.','Use the checklist as a draft only; apply policy/legal review before any personnel action.'],
      ['Disciplinary form issuance, hearing scheduling and employee notification are not connected. No personnel judgments or operational changes are made.','The local audit event records this demo access, not approval of an HR decision.'],
      'Restricted source-case workflow flags, masked before returning results. All decisions and approvals remain human-led.')


def _onboarding(f, role):
    condition='AND e.program_id=?' if f.program else '';p=[f.program] if f.program else []
    pending="(h.document_checklist_received<h.document_checklist_total OR h.identity_verification_status<>'Verified' OR h.policy_ack_status<>'Signed' OR h.workstation_access_status<>'Provisioned')"
    d=query(f'''SELECT count(*) onboarding_records,coalesce(sum(h.document_checklist_total-h.document_checklist_received),0) missing_documents,
      count(*) FILTER(WHERE {pending}) incomplete_records,
      count(*) FILTER(WHERE h.identity_verification_status<>'Verified') verification_pending,
      count(*) FILTER(WHERE h.policy_ack_status<>'Signed') policy_pending,
      count(*) FILTER(WHERE h.workstation_access_status<>'Provisioned') access_pending
      FROM hr_onboarding h JOIN employees e USING(employee_id) WHERE 1=1 {condition}''',p)[0]
    stages=[{'stage':'Collect documents','pending':d['missing_documents'],'unit':'documents'},{'stage':'Verify identity','pending':d['verification_pending'],'unit':'people'},{'stage':'Acknowledge policy','pending':d['policy_pending'],'unit':'people'},{'stage':'Provision access','pending':d['access_pending'],'unit':'people'}]
    tables=[table('Incomplete onboarding steps',stages,[('stage','Step'),('pending','Outstanding'),('unit','Unit')],['hr_onboarding','employees'],'Program-scoped snapshot of all imported hire dates. Parallel steps overlap and cannot be summed as people.')]
    if role=='HR Manager':
        rows=query(f'''SELECT h.onboarding_id,'Masked employee' employee,h.document_checklist_total-h.document_checklist_received missing_documents,
          h.identity_verification_status,h.policy_ack_status,h.workstation_access_status FROM hr_onboarding h JOIN employees e USING(employee_id)
          WHERE {pending} {condition} ORDER BY missing_documents DESC,h.onboarding_id LIMIT 20''',p)
        tables.append(table('Masked incomplete records · first 20',rows,[('onboarding_id','Onboarding ID'),('employee','Employee'),('missing_documents','Missing documents'),('identity_verification_status','Identity'),('policy_ack_status','Policy'),('workstation_access_status','Access')],['hr_onboarding'],'Restricted record details are returned only for HR Manager; identities remain masked.'))
    return result([metric('Onboarding snapshot records',d['onboarding_records']),metric('Incomplete onboarding records',d['incomplete_records']),metric('Outstanding documents',d['missing_documents'],'documents'),metric('Access provisioning pending',d['access_pending'],'people')],
      [f"{d['incomplete_records']} of {d['onboarding_records']} imported onboarding records have at least one incomplete step; {d['missing_documents']} documents are missing.",'Delay detection is unavailable: the dataset has hire dates but no step due dates, received timestamps or completion timestamps. No overdue claim is made.'],tables,
      ['Review missing documents and required ownership without requesting sensitive documents through this demo.','Route identity, policy and access exceptions to their authorized owners.','Add due/received/completed timestamps before measuring process delays.'],
      ['This is an imported snapshot including historical hires; global dates do not filter onboarding records. The program filter applies.','Document upload, identity verification, e-signatures and access provisioning are not performed.','Only HR Manager sees masked record-level examples; other personas receive aggregate counts.'],
      'Missing documents = required minus received; incomplete = any missing document or identity not Verified, policy not Signed, access not Provisioned. Counts use actual source statuses.')


def _engagement(f, role):
    w,p=a.where(f,'date','r');w=w.replace('r.program_id','e.program_id')
    d=query(f'''SELECT count(*) recognitions,count(DISTINCT r.employee_id) recognized_employees,
      coalesce(sum(r.points_awarded),0) points_awarded,count(DISTINCT r.channel) channels
      FROM employee_recognitions r JOIN employees e USING(employee_id) WHERE {w}''',p)[0]
    population=query('SELECT count(*) employees FROM employees WHERE (?=\'\' OR program_id=?)',[f.program,f.program])[0]['employees']
    types=query(f'''SELECT r.recognition_type,count(*) recognitions,sum(r.points_awarded) points_awarded
      FROM employee_recognitions r JOIN employees e USING(employee_id) WHERE {w} GROUP BY 1 ORDER BY recognitions DESC,r.recognition_type''',p)
    channels=query(f'''SELECT r.channel,r.visibility,count(*) recognitions FROM employee_recognitions r JOIN employees e USING(employee_id)
      WHERE {w} GROUP BY 1,2 ORDER BY 1,2''',p)
    return result([metric('Recognition events',d['recognitions']),metric('Recognized employees',d['recognized_employees'],'people'),metric('Source points awarded',d['points_awarded'],'points'),metric('Snapshot participation',round(100*d['recognized_employees']/population,2) if population else None,'percent')],
      [f"{d['recognized_employees']} of {population} employees in the program-scoped imported snapshot have a recognition event during the period.",f"Source events span {d['channels']} channels; {d['points_awarded']} points were awarded. This is not a redeemable balance or monetary value."],
      [table('Recognition types and points',types,[('recognition_type','Recognition type'),('recognitions','Events'),('points_awarded','Source points')],['employee_recognitions'],'Sum source points_awarded; no currency conversion.'),table('Recognition channels and visibility',channels,[('channel','Channel'),('visibility','Source visibility'),('recognitions','Events')],['employee_recognitions','employees'],'Date and employee-program scope; no employee names or individual participation lists.')],
      ['Review channel consistency and recognition accessibility with the engagement owner.','Design an opt-in engagement pilot and validate eligibility and point-redemption rules with HR before implementation.'],
      ['Birth dates, prize/redemption records and greeting delivery integrations are not supplied. Birthday messages, rewards and social posting are not executed.','Participation denominator is the imported employee snapshot, not a validated eligibility roster; no judgments about unrecognized employees are made.'],
      'Count events, distinct recognized employees, source channels and awarded points. Date filter applies to recognition events; employee denominator is a program-scoped snapshot.')


WORKFLOWS = {
    'OPP-001': _reporting, 'OPP-002': _effectiveness, 'OPP-003': _trainers,
    'OPP-004': _support, 'OPP-005': _sales, 'OPP-006': _troubleshooting,
    'OPP-007': _selfservice, 'OPP-008': _qa_reporting, 'OPP-009': _verification,
    'OPP-010': _qa_workflow, 'OPP-011': _disciplinary, 'OPP-012': _onboarding,
    'OPP-013': _engagement,
}


def run(oid, requested, role):
    d=definition(oid)
    scope,program,note=effective_scope(d,requested)
    output=WORKFLOWS[oid](scope,role)
    # Never silently omit limitations when a period/program has no observations.
    if output['metrics'] and all(m['value'] in (None,0) for m in output['metrics']):
        output['limitations'].append('No matching observations for this reporting scope. Try another period/program; zero records do not establish absence of a business problem.')
    storage.audit(role,'agent_run',oid+':'+output['status'])
    return {**output,'run_id':str(uuid4()),'opportunity_id':oid,'agent_name':d['agent']['name'],'mode':MODE,
      'generated_at':datetime.now(timezone.utc).isoformat(),'requested_filters':requested.model_dump(mode='json'),
      'filters':scope.model_dump(mode='json'),'program_name':program,'scope_note':note,'source_tables':d['agent']['tables'],
      'source_ids':[s['source_id'] for s in d['sources']],
      'original_problem':d['primary_problem'],'original_requirements':{'kind':'Original Movate requirements','problem':d['primary_problem'],'source_ids':[s['source_id'] for s in d['sources']]},
      'observed_label':'Observed synthetic data','actions_label':'Recommended actions — human review required',
      'scenario_assumptions':{'kind':'Scenario assumptions','message':'Agent results contain no claimed savings. Existing solution costs/effects remain illustrative, unvalidated USD assumptions and are calculated separately in the comparison.','comparison_url':'/agents/'+oid+'?compare=1'},
      'execution':{'local_only':True,'external_calls':0,'operational_changes_applied':False,'rule_assumptions': 'Review thresholds and bands are declared in method/limitations; they are not source requirements.'}}
