import json
import sqlite3
from datetime import date
import duckdb
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from backend import data,analytics as a,storage,ai
from backend.main import app


@pytest.fixture(scope='session',autouse=True)
def imported():
    status=data.ingest()
    assert status['ready'],status.get('errors')
    return status


@pytest.fixture
def client(tmp_path,monkeypatch):
    # User work is isolated from saved demo conversations and plans.
    monkeypatch.setattr(storage,'STORE',tmp_path)
    with TestClient(app) as c:
        yield c


def test_real_counts_and_traceability(imported):
    assert imported['row_count_benchmarks']=={'interactions':12000,'qa_audits':2200,'employees':240,'training_enrollments':1000}
    assert imported['source_entries']==19
    assert imported['canonical_opportunities']==13
    assert imported['workbook_requirement_rows']==19
    assert all(m['normalized_match'] for m in imported['source_matches'])
    assert all(r['orphan_rows']==0 and r['duplicate_parent_keys']==0 for r in imported['relationships'])
    assert all(c['inconsistent_fields']==0 for c in imported['contextual_relationship_checks'])
    assert all(v['mismatched_groups']==0 for v in imported['reconciliation'].values())
    assert sum(m['matched'] for m in imported['source_matches'])==16 # three whitespace-only differences
    for o in a.opportunities():
        detail=a.opportunity(o['opportunity_id'])
        assert len(detail['sources'])==o['source_reference_count']
        assert len(detail['alternatives'])==3
        assert all(s['workbook_original'] for s in detail['sources'])


def test_kpis_independently_from_csv():
    frame=pd.read_csv(data.ROOT/'data/raw/movate_synthetic_data/interactions.csv')
    qa=pd.read_csv(data.ROOT/'data/raw/movate_synthetic_data/qa_audits.csv')
    k=a.overview(a.Filters())['kpis']
    assert k['interactions']==len(frame)
    assert k['qa_average']==round(qa.qa_score.mean(),2)
    assert k['fcr_pct']==round(100*frame.first_contact_resolved.mean(),2)
    f=a.Filters(program='PRG-ACT',start='2026-08-01',end='2026-08-31')
    selected=frame[(frame.program_id==f.program)&frame.created_at.str[:10].between(str(f.start),str(f.end))]
    assert a.overview(f)['kpis']['interactions']==len(selected)


def test_scenario_equations_and_zero_adoption():
    for opportunity in a.opportunities():
        result=a.compare(a.ScenarioInputs(opportunity_id=opportunity['opportunity_id']))
        for o in result['options']:
            gross=o['annual_addressable_hours_assumed']*o['loaded_hourly_cost_usd_assumed']*o['effort_reduction_pct_assumed']/100
            cost=o['one_time_cost_usd_assumed']+12*o['monthly_operating_cost_usd_assumed']
            assert o['gross_annual_savings']==gross
            assert o['first_year_cost']==cost
            assert o['first_year_net_benefit']==gross-cost
            assert o['first_year_net_benefit']==o['first_year_net_benefit_usd_estimate']
    zero=a.compare(a.ScenarioInputs(opportunity_id='OPP-001',adoption_pct=0))
    assert all(o['gross_annual_savings']==0 and o['first_year_net_benefit']==-o['first_year_cost'] for o in zero['options'])
    conservative=a.compare(a.ScenarioInputs(opportunity_id='OPP-001',case='Conservative'))
    base=a.compare(a.ScenarioInputs(opportunity_id='OPP-001'))
    assert conservative['options'][0]['gross_annual_savings']==round(base['options'][0]['gross_annual_savings']*.75,2)
    assert a.compare(a.ScenarioInputs(opportunity_id='OPP-001',max_weeks=1))['recommended_option'] is None


def test_training_association_temporal_independent():
    result=a.training_summary(a.Filters())['association']
    t=pd.read_csv(data.ROOT/'data/raw/movate_synthetic_data/training_enrollments.csv')
    q=pd.read_csv(data.ROOT/'data/raw/movate_synthetic_data/qa_audits.csv')
    t=t[t.status=='Completed'].sort_values(['completion_date','enrollment_id']).drop_duplicates('employee_id')
    pairs=[]
    for _,r in t.iterrows():
        completed=pd.Timestamp(r.completion_date)
        audits=q[q.employee_id==r.employee_id].copy()
        days=pd.to_datetime(audits.audit_at).dt.normalize()
        before=audits[(days<completed)&(days>=max(pd.Timestamp('2026-07-01'),completed-pd.Timedelta(days=30)))]
        after=audits[(days>completed)&(days<=min(pd.Timestamp('2026-10-15'),completed+pd.Timedelta(days=30)))]
        if len(before) and len(after):
            pairs.append((before.qa_score.mean(),after.qa_score.mean(),len(before),len(after)))
    assert result['employees']==len(pairs)
    assert result['before_qa']==round(sum(p[0] for p in pairs)/len(pairs),2)
    assert result['after_qa']==round(sum(p[1] for p in pairs)/len(pairs),2)
    assert result['before_audits']==sum(p[2] for p in pairs)
    assert result['after_audits']==sum(p[3] for p in pairs)


@pytest.mark.parametrize('path',['/health','/operations/summary','/data/status','/overview','/programs','/opportunities','/opportunities/OPP-013','/qa/summary','/qa/audits','/training/summary','/hr/summary','/scenarios/OPP-001','/reports/summary','/reports/export?format=csv','/data/table/data_dictionary_index','/ai/provider','/ai/prompts','/action-plans','/chats'])
def test_api_routes(client,path):
    assert client.get('/api'+path).status_code==200


def test_role_enforcement_and_masking(client):
    for persona in a.ROLES:
        headers={'X-Demo-Role':persona}
        hr=client.get('/api/hr/summary',headers=headers).json()
        if persona=='HR Manager':
            assert len(hr['cases'])>0
            assert all(c['employee']=='Masked employee' and 'employee_id' not in c for c in hr['cases'])
        else:
            assert hr['cases']==[] and hr['onboarding']==[]
        assert client.get('/api/data/table/hr_cases',headers=headers).status_code==403
        assert client.get('/api/data/table/hr_onboarding',headers=headers).status_code==403
        assert client.get('/api/data/table/employees',headers=headers).status_code==403
    assert client.get('/api/hr/summary',headers={'X-Demo-Role':'Admin'}).status_code==403
    assert client.get('/api/qa/audits',headers={'X-Demo-Role':'Training Manager'}).status_code==403
    assert client.post('/api/data/import',json={},headers={'X-Demo-Role':'QA Manager'}).status_code==403


def test_sql_and_file_access_protection(client):
    assert client.get('/api/data/table/read_csv').status_code==403
    for text in ["' OR 1=1 --", "'; DROP TABLE employees;--", "read_csv('/etc/passwd')", "INSTALL httpfs; LOAD httpfs"]:
        assert client.get('/api/overview',params={'program':text}).json()['kpis']['interactions']==0
        assert client.get('/api/opportunities',params={'search':text}).json()==[]
    assert client.post('/api/sql',json={'query':'DROP TABLE employees'}).status_code==404
    with pytest.raises(duckdb.Error):
        data.query('DELETE FROM employees')
    with pytest.raises(duckdb.Error):
        data.query("SELECT * FROM read_csv('/etc/passwd')")
    assert data.query('SELECT count(*) n FROM employees')[0]['n']==240


def test_dates_empty_and_request_validation(client):
    assert client.get('/api/overview?start=2026-10-15&end=2026-07-01').status_code==422
    assert client.get('/api/overview?start=2027-01-01&end=2027-02-01').status_code==422
    assert client.get('/api/overview?start=2026-06-01').json()['filters']['start']=='2026-07-01'
    assert client.get('/api/qa/audits?limit=10000').status_code==422
    assert client.post('/api/scenarios/compare',json={'opportunity_id':'OPP-001','adoption_pct':101}).status_code==422
    assert client.get('/api/opportunities/OPP-999').status_code==404
    assert client.get('/api/overview?program=nonexistent').json()['kpis']['qa_average'] is None


def test_chat_grounding_continuity_and_local_persistence(client,monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER','disabled')
    r=client.post('/api/ai/chat',json={'message':'Why are QA scores low for Activision and what are the three solutions?'}).json()
    assert r['mode']=='Rules-based analysis'
    assert r['filters']['program']=='PRG-ACT'
    assert len(r['options'])==3
    assert r['evidence'][1]['data']['audit_count']==a.qa_summary(a.Filters(program='PRG-ACT'))['audit_count']
    assert any(c['id'].startswith('QUERY-QA') for c in r['citations'])
    follow=client.post('/api/ai/chat',json={'message':'Compare those options','chat_id':r['chat_id']}).json()
    assert follow['department']=='QA' and follow['filters']['program']=='PRG-ACT'
    resumed=client.get('/api/chats/'+r['chat_id']).json()
    assert len(resumed['messages'])==4
    assert client.get('/api/chats/'+r['chat_id'],headers={'X-Demo-Role':'HR Manager'}).status_code==404
    assert client.post('/api/ai/chat',json={'message':'follow up','chat_id':r['chat_id']},headers={'X-Demo-Role':'HR Manager'}).status_code==404
    hr=client.post('/api/ai/chat',json={'message':'Show disciplinary HR cases'},headers={'X-Demo-Role':'HR Manager'}).json()
    assert 'HRC-' not in json.dumps(hr) and 'EMP-' not in json.dumps(hr)
    unsupported=client.post('/api/ai/chat',json={'message':'Who will win the world cup?'}).json()
    assert 'does not support' in unsupported['direct_answer']
    assert client.post('/api/ai/provider/test',json={}).json()['connected'] is False


@pytest.mark.parametrize('raw',[
    {'direct_answer':'Savings are 9999999999 USD','hypotheses':[],'next_actions':[],'citation_ids':['QUERY-QA']},
    {'direct_answer':'Valid','hypotheses':[],'next_actions':[],'citation_ids':['FAKE-001']},
    {'direct_answer':'This proves training caused higher QA','hypotheses':[],'next_actions':[],'citation_ids':[]},
])
def test_provider_grounding_rejects_unsupported_claims(raw):
    with pytest.raises(ValueError):
        ai.validate_synthesis(json.dumps(raw),{'QUERY-QA'},{'score':84.26})


def test_plan_context_and_human_review_gates(client):
    plan={'opportunity_id':'OPP-011','option_id':'OPP-011-ALT-1','title':'Review draft','content':'Validate baseline and seek human review.'}
    draft=client.post('/api/action-plans',json=plan)
    assert draft.status_code==200 and draft.json()['operational_changes_applied'] is False
    assert client.post('/api/action-plans',json={**plan,'status':'Approved'}).status_code==422
    assert client.post('/api/action-plans',json={**plan,'status':'Approved','reviewer':'Human Reviewer'}).status_code==403
    approved=client.post('/api/action-plans',json={**plan,'status':'Approved','reviewer':'Human Reviewer'},headers={'X-Demo-Role':'HR Manager'})
    assert approved.status_code==200
    assert client.post('/api/action-plans',json={**plan,'option_id':'OPP-001-ALT-1'}).status_code==422
    assert len(client.get('/api/action-plans').json())==1
    with storage.connection() as c:
        with pytest.raises(sqlite3.DatabaseError):
            c.execute('DELETE FROM audit_log')


def test_missing_and_unsafe_archive_diagnostics(tmp_path,monkeypatch):
    import zipfile
    monkeypatch.setattr(data,'ROOT',tmp_path)
    monkeypatch.setattr(data,'STORE',tmp_path)
    monkeypatch.setattr(data,'STATUS',tmp_path/'status.json')
    monkeypatch.setattr(data,'discover',lambda:([],[]))
    result=data.ingest()
    assert result['ready'] is False and 'Dataset not found' in result['errors'][0]
    archive=tmp_path/'unsafe.zip'
    with zipfile.ZipFile(archive,'w') as z:
        z.writestr('../escape.txt','unsafe')
    result=data.ingest(str(archive))
    assert not result['ready'] and 'unsafe' in result['errors'][0]
    assert not (tmp_path.parent/'escape.txt').exists()


def test_configured_provider_synthesis_and_invalid_output_fallback(client,monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER','openai')
    monkeypatch.setenv('LLM_MODEL','test-model-only')
    monkeypatch.setenv('LLM_BASE_URL','http://provider.invalid/v1')
    async def valid(*args,**kwargs):
        return json.dumps({'direct_answer':'Review the linked audit evidence before selecting a pilot.','hypotheses':['Fragmented workflows may contribute.'],'next_actions':['Discuss the evidence with the quality owner.'],'citation_ids':['QUERY-QA']})
    monkeypatch.setattr(ai,'call_provider',valid)
    first=client.post('/api/ai/chat',json={'message':'Analyze QA quality scores'}).json()
    assert first['mode']=='AI-assisted explanation · validated metrics'
    assert first['explanation']=='Review the linked audit evidence before selecting a pilot.'
    assert first['direct_answer'].startswith('The selected scope has 2,200 audits')
    async def invalid(*args,**kwargs):
        # Even values that exist in evidence cannot be rearranged into a narrative denominator.
        return json.dumps({'direct_answer':'There were 240 audits and 2200 employees.','hypotheses':[],'next_actions':[],'citation_ids':['QUERY-QA']})
    monkeypatch.setattr(ai,'call_provider',invalid)
    fallback=client.post('/api/ai/chat',json={'message':'Analyze QA quality scores'}).json()
    assert fallback['mode']=='Rules-based analysis'
    assert 'grounding validation' in fallback['provider_notice']


def test_compare_intent_and_explicit_opportunity_continuity(client,monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER','disabled')
    first=client.post('/api/ai/chat',json={'message':'Analyze this opportunity','opportunity_id':'OPP-001'}).json()
    second=client.post('/api/ai/chat',json={'message':'Compare those options','chat_id':first['chat_id']}).json()
    assert second['department']=='Training' and second['opportunity_id']=='OPP-001'
    assert 'highest modeled first-year net benefit' in second['direct_answer']
    third=client.post('/api/ai/chat',json={'message':'Compare conservative and optimistic cases','opportunity_id':'OPP-001'}).json()
    assert any(e['id']=='SCENARIO-CASES-OPP-001' for e in third['evidence'])
    assert '0.75' in third['direct_answer'] and '1.2' in third['direct_answer']


def test_customer_operations_linked_records_and_typed_storage(client,monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER','disabled')
    records=a.operations_summary(a.Filters())
    frame=pd.read_csv(data.ROOT/'data/raw/movate_synthetic_data/sales_leads.csv')
    assert records['sales']['leads']==len(frame)
    assert records['sales']['completed_sales']==int(frame.sale_completed.sum())
    assert records['sales']['verification_not_verified']==int(((frame.requires_verification==1)&(frame.verification_status!='Verified')).sum())
    response=client.post('/api/ai/chat',json={'message':'What sales leads need verification?'}).json()
    assert any(e['id']=='QUERY-CUSTOMER-OPERATIONS' for e in response['evidence'])
    assert str(len(frame)) in response['direct_answer']
    stored={c['column_name']:c['column_type'] for c in data.query('DESCRIBE interactions')}
    assert stored['created_at'].startswith('TIMESTAMP')
    stored={c['column_name']:c['column_type'] for c in data.query('DESCRIBE training_enrollments')}
    assert stored['completion_date']=='DATE'


def test_followup_retains_explicit_dates_but_respects_changed_global_scope(client,monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER','disabled')
    first=client.post('/api/ai/chat',json={'message':'Analyze QA for Activision from 2026-08-01 to 2026-08-31'}).json()
    second=client.post('/api/ai/chat',json={'message':'Compare those options','chat_id':first['chat_id']}).json()
    assert second['filters']['start']=='2026-08-01' and second['filters']['end']=='2026-08-31'
    changed=client.post('/api/ai/chat',json={'message':'What about those options?','chat_id':first['chat_id'],'filters':{'program':'PRG-HD','start':'2026-09-01','end':'2026-09-30'}}).json()
    assert changed['filters']['program']=='PRG-HD' and changed['filters']['start']=='2026-09-01'


def test_opportunity_program_scope_keeps_cross_department_requirements():
    scoped={o['opportunity_id'] for o in a.opportunities(program='PRG-ACT')}
    assert 'OPP-007' in scoped and 'OPP-004' not in scoped
    assert {'OPP-001','OPP-008','OPP-012'}.issubset(scoped)
