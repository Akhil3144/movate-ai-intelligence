"""Exercise the actual ASGI function on Python 3.12 without local ingestion/dev dependencies."""
import json
import os
import secrets
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['MOVATE_SERVERLESS']='1'
os.environ['MOVATE_DEMO_USERNAME']='local-runtime-check'
os.environ['MOVATE_DEMO_PASSWORD']=secrets.token_urlsafe(32)
os.environ['LLM_PROVIDER']='openai'  # Hosted policy must override even this setting.
from fastapi.testclient import TestClient
from api.index import app
from backend import data,storage
from backend.ai import provider_config


def verify():
    assert 'pandas' not in sys.modules and 'openpyxl' not in sys.modules
    auth=(os.environ['MOVATE_DEMO_USERNAME'],os.environ['MOVATE_DEMO_PASSWORD'])
    results={}
    with TestClient(app,base_url='https://private-preview.test') as c:
        assert c.get('/api/overview').status_code==401
        assert c.get('/docs').status_code==401
        assert c.get('/api/auth/login').status_code==401
        login=c.get('/api/auth/login?next=/agents',auth=auth,follow_redirects=False)
        assert login.status_code==303 and 'HttpOnly' in login.headers['set-cookie'] and 'Secure' in login.headers['set-cookie']
        assert c.get('/api/overview').status_code==200
        assert c.get('/api/health').json()['persistence']=='browser-local'
        direct=c.get('/api/index?__movate_path=/api/overview&program=PRG-ACT')
        assert direct.status_code==200 and direct.json()['filters']['program']=='PRG-ACT'
        assert c.get('/api/index?__movate_path=/etc/passwd').status_code==400
        agents=c.get('/api/agents').json()
        assert len(agents)==13
        for definition in agents:
            oid=definition['opportunity_id']
            response=c.post('/api/agents/'+oid+'/run',json={},headers={'X-Demo-Role':'HR Manager'})
            assert response.status_code==200,response.text
            assert response.json()['metrics'],oid
            results[oid]=response.json()['status']
        for path in ['/api/qa/summary','/api/training/summary','/api/hr/summary','/api/reports/summary','/api/reports/export?format=csv','/api/scenarios/OPP-001','/api/data/status']:
            response=c.get(path)
            assert response.status_code==200,(path,response.text)
        first=c.post('/api/ai/chat',json={'message':'Analyze QA for Activision from 2026-08-01 to 2026-08-31'}).json()
        assert first['mode']=='Rules-based analysis'
        second=c.post('/api/ai/chat',json={'message':'Compare those options','chat_id':first['chat_id'],'history':[{'kind':'user','text':'Analyze QA for Activision from 2026-08-01 to 2026-08-31'},{'kind':'assistant','opportunity_id':first['opportunity_id'],'filters':first['filters'],'global_filters':first['global_filters']}]}).json()
        assert second['filters']['start']=='2026-08-01' and second['filters']['program']=='PRG-ACT'
        plan=c.post('/api/action-plans',json={'opportunity_id':'OPP-012','title':'Onboarding review','content':'Validate missing steps with HR.'}).json()
        assert plan['persistence'].startswith('browser-local')
        assert c.get('/api/action-plans').json()==[] and c.get('/api/chats').json()==[]
        assert c.post('/api/data/import',json={}).status_code==405
        assert provider_config()['provider']=='disabled'
        assert c.post('/api/agents/OPP-001/run',json={},headers={'Origin':'https://attacker.invalid'}).status_code==403
        assert c.get('/api/not-a-route').status_code==404
        status=c.get('/api/data/status').text
        assert '/Users/' not in status and '/home/' not in status
    try:
        storage.connection()
        raise AssertionError('SQLite must not be used in serverless mode')
    except RuntimeError:
        pass
    print(json.dumps({'python':sys.version.split()[0],'entrypoint':'api.index:app','authenticated':True,'agents':results,'tables':len(data.TABLES),'sqlite_used':False,'pandas_imported':'pandas' in sys.modules,'external_provider':provider_config()['provider'],'rewrite_forwarding':'passed','browser_context_followup':'passed'},indent=2))


if __name__=='__main__':
    verify()
