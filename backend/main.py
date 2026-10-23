import csv
import io
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI,Depends,Header,HTTPException,Query,Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse,Response
from pydantic import BaseModel,Field

from . import data,analytics as a,storage,ai,agents
from .runtime import serverless
from .access import protect

logging.basicConfig(level=logging.INFO,format='%(message)s')
log=logging.getLogger('movate')


@asynccontextmanager
async def lifespan(app):
    if not serverless():
        if not data.DB.exists():
            data.ingest()
        with storage.connection():
            pass
    yield


app=FastAPI(title='Movate AI Operations Intelligence',version='1.0.0',lifespan=lifespan)
app.middleware('http')(protect)


@app.middleware('http')
async def log_requests(request,call_next):
    start=time.monotonic()
    response=await call_next(request)
    log.info(json.dumps({'event':'request','method':request.method,'path':request.url.path,'status':response.status_code,'ms':round((time.monotonic()-start)*1000)}))
    return response


@app.exception_handler(data.DataInitializationError)
async def dataset_error(request,exc):
    log.error(json.dumps({'event':'dataset_initialization_failed','cause':type(exc.__cause__).__name__ if exc.__cause__ else 'unknown'}))
    return JSONResponse(status_code=503,content={'error':{'code':'DATA_INIT_FAILED','message':str(exc)}})


@app.exception_handler(HTTPException)
async def http_error(request,exc):
    return JSONResponse(status_code=exc.status_code,content={'error':{'code':exc.status_code,'message':str(exc.detail)}})


@app.exception_handler(RequestValidationError)
async def validation_error(request,exc):
    return JSONResponse(status_code=422,content={'error':{'code':422,'message':'Invalid request','details':[{k:str(v) for k,v in e.items() if k in {'loc','msg','type'}} for e in exc.errors()]}})


@app.exception_handler(Exception)
async def unhandled(request,exc):
    log.exception(json.dumps({'event':'unhandled','path':request.url.path}))
    return JSONResponse(status_code=500,content={'error':{'code':500,'message':'The operation failed. Check backend logs and Data & Settings diagnostics.'}})


def role(x_demo_role: str = Header(default='Executive')):
    if x_demo_role not in a.ROLES:
        raise HTTPException(403,'Unknown demo persona')
    return x_demo_role


def ready():
    status=data.get_status()
    if not status.get('ready') or not data.DB.exists():
        raise HTTPException(503,'Dataset unavailable. Open Data & Settings to import and inspect diagnostics.')


@app.get('/api/health')
def health():
    return {'status':'ok','dataset_ready':data.get_status().get('ready',False) and data.DB.exists(),'synthetic':True,'persistence':'browser-local' if serverless() else 'local-sqlite','read_only_dataset':serverless(),'external_inference':False if serverless() else None}


@app.get('/api/data/status')
def status(persona=Depends(role)):
    return data.get_status()


class ImportRequest(BaseModel):
    zip_path: str | None = Field(default=None,max_length=2000)


@app.post('/api/data/import')
def import_data(body:ImportRequest,persona=Depends(role)):
    if serverless():
        raise HTTPException(405,'Hosted dataset is a bundled read-only snapshot. Prepare the bundle locally and redeploy to refresh it.')
    if persona!='Executive':
        raise HTTPException(403,'Switch to Executive to refresh source files')
    result=data.ingest(body.zip_path)
    storage.audit(persona,'data_import','ready='+str(result['ready']))
    return result


@app.get('/api/programs',dependencies=[Depends(ready)])
def programs():
    return data.query('SELECT * FROM programs ORDER BY program_name')


@app.get('/api/overview',dependencies=[Depends(ready)])
def overview(f=Depends(a.filters)):
    return a.overview(f)


@app.get('/api/opportunities',dependencies=[Depends(ready)])
def opportunities(search:str='',department:str='',program:str='',complexity:str='',priority:str='',limit:int=Query(50,ge=1,le=100),offset:int=Query(0,ge=0)):
    return a.opportunities(search,department,program,complexity,priority,limit,offset)


@app.get('/api/opportunities/{oid}',dependencies=[Depends(ready)])
def opportunity(oid:str):
    return a.opportunity(oid)


@app.get('/api/agents',dependencies=[Depends(ready)])
def agent_catalog(search:str='',department:str='',program:str='',complexity:str='',priority:str='',limit:int=Query(50,ge=1,le=100),offset:int=Query(0,ge=0),persona=Depends(role)):
    return agents.catalog(search,department,program,complexity,priority,limit,offset)


@app.get('/api/agents/{oid}',dependencies=[Depends(ready)])
def agent_definition(oid:str,persona=Depends(role)):
    return agents.definition(oid)


@app.post('/api/agents/{oid}/run',dependencies=[Depends(ready)])
def run_agent(oid:str,body:agents.RunRequest,persona=Depends(role)):
    return agents.run(oid,body.filters,persona)


@app.get('/api/scenarios/{oid}',dependencies=[Depends(ready)])
def scenarios(oid:str):
    a.opportunity(oid)
    return a.compare(a.ScenarioInputs(opportunity_id=oid))


@app.post('/api/scenarios/compare',dependencies=[Depends(ready)])
def compare(body:a.ScenarioInputs):
    a.opportunity(body.opportunity_id)
    return a.compare(body)


@app.get('/api/operations/summary',dependencies=[Depends(ready)])
def operations(f=Depends(a.filters)):
    return a.operations_summary(f)


@app.get('/api/qa/summary',dependencies=[Depends(ready)])
def qa(f=Depends(a.filters)):
    return a.qa_summary(f)


@app.get('/api/qa/audits',dependencies=[Depends(ready)])
def audits(f=Depends(a.filters),search:str='',limit:int=Query(25,ge=1,le=100),offset:int=Query(0,ge=0),persona=Depends(role)):
    if persona not in {'Executive','QA Manager'}:
        raise HTTPException(403,'Audit drilldown requires Executive or QA Manager')
    w,p=a.where(f,'audit_at','a')
    return data.query(f'''SELECT a.*,e.display_name,c.coaching_id,c.status coaching_status,c.action_plan
      FROM qa_audits a JOIN employees e USING(employee_id) LEFT JOIN coaching_actions c USING(audit_id)
      WHERE {w} AND (lower(a.audit_id || ' ' || e.display_name || ' ' || a.finding_category) LIKE ?)
      ORDER BY a.audit_at DESC LIMIT ? OFFSET ?''',p+['%'+search.lower()+'%',limit,offset])


@app.get('/api/training/summary',dependencies=[Depends(ready)])
def training(f=Depends(a.filters)):
    return a.training_summary(f)


@app.get('/api/hr/summary',dependencies=[Depends(ready)])
def hr(f=Depends(a.filters),persona=Depends(role)):
    if persona=='HR Manager':
        storage.audit(persona,'hr_masked_view','program='+f.program)
    return a.hr_summary(f,persona)


@app.post('/api/ai/chat',dependencies=[Depends(ready)])
async def chat(body:ai.ChatRequest,persona=Depends(role)):
    try:
        return await ai.answer(body,persona)
    except ValueError as e:
        raise HTTPException(422,str(e))


@app.get('/api/ai/provider')
def provider(persona=Depends(role)):
    c=ai.provider_config()
    return {'provider':c['provider'],'model':c['model'],'configured':bool(c['model'] and c['base_url']),'connected':None,'message':'Not tested in this session. Use Test connection.'}


@app.post('/api/ai/provider/test')
async def provider_test(persona=Depends(role)):
    return await ai.provider_test()


@app.get('/api/ai/prompts')
def prompts():
    return ai.PROMPTS


@app.get('/api/chats')
def chats(persona=Depends(role)):
    return storage.chats(persona)


@app.get('/api/chats/{cid}')
def chat_detail(cid:str,persona=Depends(role)):
    c=storage.get_chat(cid,persona)
    if not c:
        raise HTTPException(404,'Chat not found for this persona')
    return c


class PlanRequest(BaseModel):
    opportunity_id:str = Field(pattern=r'^OPP-\d{3}$')
    option_id:str | None = None
    title:str = Field(min_length=1,max_length=200)
    content:str = Field(min_length=1,max_length=15000)
    status:str = Field(default='Draft',pattern='^(Draft|Approved)$')
    reviewer:str = Field(default='',max_length=120)


@app.post('/api/action-plans',dependencies=[Depends(ready)])
def save_plan(body:PlanRequest,persona=Depends(role)):
    opp=a.opportunity(body.opportunity_id)
    if body.option_id and not any(o['option_id']==body.option_id for o in opp['alternatives']):
        raise HTTPException(422,'Option does not belong to this opportunity')
    if body.status=='Approved':
        if not body.reviewer.strip():
            raise HTTPException(422,'A named human reviewer is required')
        required={'HR':'HR Manager','QA':'QA Manager','Training':'Training Manager'}.get(opp['department'],'Executive')
        if persona != required:
            raise HTTPException(403,f'Approval requires {required}')
    pid=str(uuid.uuid4())
    payload={**body.model_dump(),'id':pid,'synthetic':True,'operational_changes_applied':False}
    if not serverless():
        with storage.connection() as c:
            c.execute('INSERT INTO plans VALUES(?,?,?,?)',(pid,persona,json.dumps(payload),storage.now()))
    else:
        payload['persistence']='browser-local; client must save this validated artifact'
    storage.audit(persona,'action_plan_'+body.status.lower(),pid)
    return payload


@app.get('/api/action-plans')
def plans(persona=Depends(role)):
    if serverless():
        return []
    with storage.connection() as c:
        return [json.loads(r['payload']) for r in c.execute('SELECT payload FROM plans WHERE role=? ORDER BY created_at DESC LIMIT 100',(persona,))]


@app.get('/api/reports/summary',dependencies=[Depends(ready)])
def report(f=Depends(a.filters),department:str='',persona=Depends(role)):
    result={'title':'Movate AI Operations Intelligence','synthetic':True,'filters':f.model_dump(mode='json'),'overview':a.overview(f),
      'limitations':['All records are synthetic. Program names are scenario labels, not proof of client relationships.','Financial scenarios are illustrative, unvalidated USD assumptions and are not additive.']}
    if department in {'','QA'}:
        result['quality']=a.qa_summary(f)
    if department in {'','Training'}:
        result['training']=a.training_summary(f)
    if department in {'','HR'}:
        hr=a.hr_summary(f,persona)
        result['hr']={k:v for k,v in hr.items() if k not in {'cases','onboarding'}}
    if department in {'','Customer Operations'}:
        result['customer_operations']=a.operations_summary(f)
    result['opportunities']=a.opportunities(department=department)
    return result


@app.get('/api/reports/export',dependencies=[Depends(ready)])
def report_export(f=Depends(a.filters),department:str='',format:str=Query('json',pattern='^(json|csv)$'),persona=Depends(role)):
    report_data=report(f,department,persona)
    if format=='json':
        return Response(json.dumps(report_data,indent=2),media_type='application/json',headers={'Content-Disposition':'attachment; filename=movate-report.json'})
    stream=io.StringIO()
    writer=csv.writer(stream)
    writer.writerow(['Synthetic Demo Data','metric','value','scope'])
    for key,value in report_data['overview']['kpis'].items():
        writer.writerow(['synthetic',key,value,json.dumps(f.model_dump(mode='json'))])
    return Response(stream.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename=movate-kpis.csv'})


@app.get('/api/data/table/{table}',dependencies=[Depends(ready)])
def table_data(table:str,limit:int=Query(25,ge=1,le=100),offset:int=Query(0,ge=0),persona=Depends(role)):
    # HR and employee raw data are never exposed through the general data inspector.
    allowed=set(data.TABLES)-{'hr_cases','hr_onboarding','employees'}
    if table not in allowed:
        raise HTTPException(403,'This table is restricted or not supported. Use the masked department view.')
    return data.query(f'SELECT * FROM {data.ident(table)} LIMIT ? OFFSET ?',[limit,offset])


@app.get('/api/audit-log')
def audit_log(persona=Depends(role)):
    if serverless():
        return []
    with storage.connection() as c:
        return [dict(r) for r in c.execute('SELECT * FROM audit_log WHERE role=? ORDER BY created_at DESC LIMIT 100',(persona,))]
