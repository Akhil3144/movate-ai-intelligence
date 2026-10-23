import base64
import json
from pathlib import Path
import shutil
import time
import pytest
from fastapi.testclient import TestClient
from backend import data,storage,ai
from backend.main import app
from backend.access import VercelPathMiddleware,token,COOKIE

USER='test-only-demo-user'
PASSWORD='test-only-password-not-a-deployment-secret-12345'


@pytest.fixture
def hosted(monkeypatch,tmp_path):
    monkeypatch.setenv('MOVATE_SERVERLESS','1')
    monkeypatch.setenv('MOVATE_DEMO_USERNAME',USER)
    monkeypatch.setenv('MOVATE_DEMO_PASSWORD',PASSWORD)
    monkeypatch.setattr(data,'DB',data.ROOT/'deployment/data/movate.duckdb')
    monkeypatch.setattr(data,'STATUS',data.ROOT/'deployment/data/status.json')
    monkeypatch.setattr(data,'_bundle_validated',None)
    monkeypatch.setattr(storage,'STORE',tmp_path)
    with TestClient(VercelPathMiddleware(app),base_url='https://testserver') as client:
        client.auth=(USER,PASSWORD)
        yield client
    assert not list(tmp_path.glob('*.sqlite*'))


def test_fail_closed_and_backend_auth_required(hosted,monkeypatch):
    assert hosted.get('/api/overview',auth=None).status_code==401
    assert hosted.get('/docs',auth=None).status_code==401
    assert hosted.get('/api/overview',auth=('bad','bad')).status_code==401
    assert hosted.get('/api/overview').status_code==200
    monkeypatch.delenv('MOVATE_DEMO_PASSWORD')
    assert hosted.get('/api/overview').status_code==503


def test_secure_cookie_rejects_forgery_expiry_and_open_redirect(hosted):
    response=hosted.get('/api/auth/login?next=//external.test',follow_redirects=False)
    assert response.status_code==303 and response.headers['location']=='/'
    assert hosted.get('/api/auth/login',params={'next':'/'+chr(92)+'external.test'},follow_redirects=False).headers['location']=='/'
    cookie=response.headers['set-cookie']
    assert 'HttpOnly' in cookie and 'Secure' in cookie and 'SameSite=strict' in cookie
    assert hosted.get('/api/overview',auth=None).status_code==200
    hosted.cookies.clear()
    hosted.cookies.set(COOKIE,token(USER,PASSWORD,int(time.time())-5))
    assert hosted.get('/api/overview',auth=None).status_code==401
    hosted.cookies.set(COOKIE,token(USER,'incorrect-signature-secret',int(time.time())+500))
    assert hosted.get('/api/overview',auth=None).status_code==401
    assert hosted.post('/api/scenarios/compare',json={'opportunity_id':'OPP-001'},headers={'Origin':'https://another.test'}).status_code==403


def test_forwarded_path_and_unknown_api_never_return_spa(hosted):
    response=hosted.get('/api/index?__movate_path=/api/overview&program=PRG-ACT')
    assert response.status_code==200 and response.json()['filters']['program']=='PRG-ACT'
    assert hosted.get('/api/index?__movate_path=/etc/passwd').status_code==400
    response=hosted.get('/api/index?__movate_path=/api/missing')
    assert response.status_code==404 and 'application/json' in response.headers['content-type']


def test_no_server_persistence_imports_or_external_provider(hosted,monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER','openai')
    monkeypatch.setenv('LLM_MODEL','not-permitted')
    assert ai.provider_config()['provider']=='disabled'
    assert hosted.post('/api/data/import',json={}).status_code==405
    plan=hosted.post('/api/action-plans',json={'opportunity_id':'OPP-001','title':'Browser draft','content':'Review baseline.'})
    assert plan.status_code==200 and 'browser-local' in plan.json()['persistence']
    assert hosted.get('/api/action-plans').json()==[]
    assert hosted.get('/api/chats').json()==[]
    assert hosted.get('/api/audit-log').json()==[]
    assert '/Users/' not in hosted.get('/api/data/status').text


def test_corrupt_or_missing_bundle_has_clear_503(hosted,monkeypatch,tmp_path):
    copied=tmp_path/'bundle';shutil.copytree(data.ROOT/'deployment/data',copied)
    monkeypatch.setattr(data,'DB',copied/'movate.duckdb')
    monkeypatch.setattr(data,'STATUS',copied/'status.json')
    monkeypatch.setattr(data,'_bundle_validated',None)
    (copied/'status.json').write_text('{}')
    response=hosted.get('/api/overview')
    assert response.status_code==503 and response.json()['error']['code']=='DATA_INIT_FAILED'
    assert 'Redeploy a validated bundle' in response.text


def test_bundle_is_reused_without_reingestion(hosted,monkeypatch):
    assert hosted.get('/api/overview').status_code==200
    def forbidden(*args,**kwargs):raise AssertionError('No repeated preparation or checksum work on warm invocation')
    monkeypatch.setattr(data,'ingest',forbidden)
    monkeypatch.setattr(data.hashlib,'sha256',forbidden)
    # Auth HMAC also uses hashlib.sha256, so use the existing cookie before patching the checksum function.
    # An authenticated Basic header avoids token creation/verification for this warm request.
    assert hosted.get('/api/qa/summary').status_code==200
