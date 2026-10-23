"""All thirteen agent workflows, checked against original CSV records."""
import hashlib
from pathlib import Path
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend import agents,analytics as a,data,storage,ai
from backend.main import app


@pytest.fixture(scope='module')
def frames():
    if not data.DB.exists():
        assert data.ingest()['ready']
    return {name:pd.read_csv(data.ROOT/'data/raw/movate_synthetic_data'/f'{name}.csv') for name in data.TABLES}


@pytest.fixture
def client(tmp_path,monkeypatch,frames):
    monkeypatch.setattr(storage,'STORE',tmp_path)
    with TestClient(app) as client:
        yield client


def values(response):
    return {m['label']:m['value'] for m in response['metrics']}


def run(client,oid,filters=None,role='HR Manager'):
    response=client.post(f'/api/agents/{oid}/run',json={'filters':filters or {}},headers={'X-Demo-Role':role})
    assert response.status_code==200,response.text
    return response.json()


def test_catalog_is_bijective_and_sources_unchanged(client,frames):
    rows=client.get('/api/agents').json()
    assert {r['opportunity_id'] for r in rows}==set(frames['opportunity_catalog'].opportunity_id)==set(agents.SPECS)==set(agents.WORKFLOWS)
    assert len(rows)==13 and len({r['agent']['name'] for r in rows})==13
    assert len(set(agents.WORKFLOWS.values()))==13
    for row in rows:
        oid=row['opportunity_id'];original=frames['opportunity_catalog'].set_index('opportunity_id').loc[oid]
        assert row['primary_problem']==original.primary_problem
        detail=client.get('/api/agents/'+oid).json()
        assert detail['original_problem']==original.primary_problem
        expected=frames['source_opportunities'][frames['source_opportunities'].opportunity_id==oid]
        assert {s['source_id'] for s in detail['sources']}==set(expected.source_id)
        for source in detail['sources']:
            actual=expected.set_index('source_id').loc[source['source_id']]
            assert source['problem_statement']==actual.problem_statement
            assert source['proposed_solution']==actual.proposed_solution
            assert source['workbook_original'] # exact cells incl. original whitespace retained
        assert {s['option_id'] for s in detail['alternatives']}==set(frames['solution_alternatives'].loc[lambda f:f.opportunity_id==oid,'option_id'])
        assert set(detail['agent']['tables']).issubset(data.TABLES)


@pytest.mark.parametrize('oid',list(agents.SPECS))
def test_every_workflow_executes_local_analysis(client,oid,monkeypatch,frames):
    async def forbidden(*args,**kwargs):
        raise AssertionError('An agent must never call an external model')
    monkeypatch.setattr(ai,'call_provider',forbidden)
    monkeypatch.setenv('LLM_PROVIDER','openai')
    monkeypatch.setenv('LLM_BASE_URL','http://must-not-be-called.invalid/v1')
    result=run(client,oid)
    assert result['status']=='completed'
    assert result['opportunity_id']==oid
    assert result['mode']=='AI Agent Demo — Rules-Based'
    assert result['execution']=={'local_only':True,'external_calls':0,'operational_changes_applied':False,'rule_assumptions':'Review thresholds and bands are declared in method/limitations; they are not source requirements.'}
    assert result['metrics'] and result['findings'] and result['tables'] and result['recommended_actions']
    assert result['limitations'] and result['method'] and result['source_ids']
    assert result['scenario_assumptions']['kind']=='Scenario assumptions'
    assert result['original_problem']==frames['opportunity_catalog'].set_index('opportunity_id').loc[oid,'primary_problem']
    assert result['source_tables']==agents.SPECS[oid]['tables']
    assert all(t['source_tables'] and t['method'] and t['kind']=='Observed synthetic data' for t in result['tables'])


def test_each_workflow_uses_the_correct_record_denominators(client,frames):
    training=frames['training_enrollments']; audits=frames['qa_audits']; interactions=frames['interactions']
    programs=frames['programs'].set_index('program_name').program_id.to_dict()
    report=values(run(client,'OPP-001'))
    assert report['Assigned enrollments']==len(training)
    assert report['Completed by period end']==int(((training.status=='Completed')&(training.completion_date<='2026-10-15')).sum())
    paired=values(run(client,'OPP-002'))
    assert paired['After QA mean']-paired['Before QA mean']==pytest.approx(paired['Observed QA difference'],abs=.01)
    trainers=values(run(client,'OPP-003'))
    ids=set(training.trainer_id);source_trainers=frames['trainers'][frames['trainers'].trainer_id.isin(ids)]
    assert trainers['Trainers with assignments']==len(source_trainers)
    assert trainers['Playbook review candidates']==int((source_trainers.digital_playbook_adoption_pct<80).sum())
    support=values(run(client,'OPP-004'))
    hd=interactions[interactions.program_id==programs['Home Depot']]
    assert support['Linked support contacts']==len(hd)
    assert support['Not resolved on first contact']==int((hd.first_contact_resolved==0).sum())
    leads=frames['sales_leads'].merge(interactions[['interaction_id','program_id']],on='interaction_id')
    sxm=leads[leads.program_id==programs['SXM Outbound']]
    sales=values(run(client,'OPP-005'))
    assert sales['Linked sales leads']==len(sxm)
    assert sales['Completed sales']==int(sxm.sale_completed.sum())
    assert sales['Observed conversion']==round(100*sxm.sale_completed.mean(),2)
    product=values(run(client,'OPP-006'))
    elvie=interactions[interactions.program_id==programs['Elvie']]
    assert product['Troubleshooting contacts']==len(elvie)
    assert product['High-complexity contacts']==int((elvie.complexity=='High').sum())
    act=interactions[interactions.program_id==programs['Activision']]
    selfservice=values(run(client,'OPP-007'))
    assert selfservice['Source-flagged eligible']==int(act.self_service_eligible.sum())
    assert selfservice['Campaign-peak contacts']==int(act.is_campaign_peak.sum())
    qa=values(run(client,'OPP-008'))
    assert qa['Audits in period']==len(audits)
    assert qa['Critical-error audits']==int(audits.critical_error.sum())
    verification=values(run(client,'OPP-009'))
    completed=sxm[sxm.sale_completed==1]
    assert verification['Completed-sale leads']==len(completed)
    assert verification['Required but not Verified']==int(((completed.requires_verification==1)&(completed.verification_status!='Verified')).sum())
    assert verification['Completed sales with audit']==int(completed.interaction_id.isin(audits.interaction_id).sum())
    workflow=values(run(client,'OPP-010'))
    assert workflow['Audit platforms']==audits.audit_platform.nunique()
    assert workflow['Audit acknowledgements pending']==int((audits.acknowledgement_status!='Acknowledged').sum())
    cases=frames['hr_cases'];hr=values(run(client,'OPP-011'))
    assert hr['Cases in period']==len(cases)
    assert hr['Approval not recorded as Approved']==int((cases.hr_approval_status!='Approved').sum())
    onboarding=frames['hr_onboarding'];onb=values(run(client,'OPP-012'))
    assert onb['Outstanding documents']==int((onboarding.document_checklist_total-onboarding.document_checklist_received).sum())
    incomplete=(onboarding.document_checklist_received<onboarding.document_checklist_total)|(onboarding.identity_verification_status!='Verified')|(onboarding.policy_ack_status!='Signed')|(onboarding.workstation_access_status!='Provisioned')
    assert onb['Incomplete onboarding records']==int(incomplete.sum())
    recognition=frames['employee_recognitions'];engagement=values(run(client,'OPP-013'))
    assert engagement['Recognition events']==len(recognition)
    assert engagement['Source points awarded']==int(recognition.points_awarded.sum())
    assert engagement['Recognized employees']==recognition.employee_id.nunique()


@pytest.mark.parametrize('oid',list(agents.SPECS))
def test_every_agent_handles_empty_scope_and_declares_limitations(client,oid):
    result=run(client,oid,{'program':'NO-SUCH-PROGRAM','start':'2026-07-01','end':'2026-07-01'})
    assert result['status']=='completed' and result['limitations']
    assert all(m['value'] in (0,None) for m in result['metrics'])
    assert any('No matching observations' in s for s in result['limitations'])


def test_period_program_overrides_and_source_program_defaults(client,frames):
    default=run(client,'OPP-004')
    assert default['program_name']=='Home Depot' and 'original requirement' in default['scope_note']
    changed=run(client,'OPP-004',{'program':'PRG-ACT','start':'2026-08-01','end':'2026-08-31'})
    filtered=frames['interactions'].loc[lambda f:(f.program_id=='PRG-ACT')&f.created_at.str[:10].between('2026-08-01','2026-08-31')]
    assert values(changed)['Linked support contacts']==len(filtered)
    assert 'overrides' in changed['scope_note']
    assert client.post('/api/agents/OPP-001/run',json={'filters':{'start':'2027-01-01','end':'2027-02-01'}}).status_code==422
    assert client.post('/api/agents/OPP-999/run',json={}).status_code==404


def test_hr_privacy_is_enforced_before_query_and_draft_contains_no_identity(client,monkeypatch):
    original=agents.query;calls=[]
    def watched(sql,args=None):
        calls.append(sql)
        return original(sql,args)
    monkeypatch.setattr(agents,'query',watched)
    result=run(client,'OPP-011',role='Executive')
    assert result['status']=='restricted' and not result['metrics'] and not result['tables']
    assert not any('FROM hr_cases' in q for q in calls)
    assert any('HR Manager' in s for s in result['limitations'])
    authorized=run(client,'OPP-011')
    text=str(authorized)
    assert 'EMP-' not in text and '[SYN]' not in text and 'Masked employee' in text
    for role in ['Executive','QA Manager','Training Manager']:
        onboarding=run(client,'OPP-012',role=role)
        assert len(onboarding['tables'])==1 and 'ONB-' not in str(onboarding)
    assert client.post('/api/agents/OPP-001/run',json={},headers={'X-Demo-Role':'Unknown'}).status_code==403


def test_runs_leave_sources_and_scenario_equations_intact(client,frames):
    before={t:data.query(f'SELECT count(*) n FROM {data.ident(t)}')[0]['n'] for t in data.TABLES}
    source_files={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in (data.ROOT/'data/raw/movate_synthetic_data').glob('*.csv')}
    scenarios=a.compare(a.ScenarioInputs(opportunity_id='OPP-001'))
    for oid in agents.SPECS:run(client,oid)
    assert a.compare(a.ScenarioInputs(opportunity_id='OPP-001'))==scenarios
    assert {t:data.query(f'SELECT count(*) n FROM {data.ident(t)}')[0]['n'] for t in data.TABLES}==before
    assert all(hashlib.sha256(p.read_bytes()).hexdigest()==h for p,h in source_files.items())
    assert len(client.get('/api/audit-log',headers={'X-Demo-Role':'HR Manager'}).json())==len(agents.SPECS)


def test_search_pagination_and_scenario_option_filters(client):
    found=client.get('/api/agents',params={'search':'Onboarding Agent'}).json()
    assert [r['opportunity_id'] for r in found]==['OPP-012']
    assert len(client.get('/api/agents?department=Training').json())==3
    assert len(client.get('/api/agents?limit=2&offset=2').json())==2
    assert client.get('/api/agents?limit=101').status_code==422
    assert {r['opportunity_id'] for r in client.get('/api/agents?program=PRG-ACT').json()}.issuperset({'OPP-007','OPP-008','OPP-012'})
