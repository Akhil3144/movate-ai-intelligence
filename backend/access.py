"""Server-side demo access control, independent of frontend UI and demo personas."""
import base64
import hashlib
import hmac
import json
import os
import time
from urllib.parse import parse_qsl, urlencode, urlsplit
from starlette.responses import JSONResponse, RedirectResponse
from .runtime import serverless

COOKIE = '__Secure-movate-demo'
REALM = 'Movate private demonstration'


def credentials():
    return os.getenv('MOVATE_DEMO_USERNAME',''), os.getenv('MOVATE_DEMO_PASSWORD','')


def token(user,password,expires):
    payload=f'{user}:{expires}'.encode()
    signature=hmac.new(password.encode(),b'movate-demo-session-v1:'+payload,hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(payload).decode()+'.'+signature


def accepted(request):
    user,password=credentials()
    if not user or len(password)<24:
        return False
    header=request.headers.get('authorization','')
    if header.startswith('Basic '):
        try:
            supplied=base64.b64decode(header[6:],validate=True).decode().split(':',1)
            if len(supplied)==2 and hmac.compare_digest(supplied[0].encode(),user.encode()) and hmac.compare_digest(supplied[1].encode(),password.encode()):
                return True
        except (ValueError,UnicodeDecodeError):
            pass
    value=request.cookies.get(COOKIE,'')
    try:
        payload,signature=value.rsplit('.',1)
        decoded=base64.urlsafe_b64decode(payload).decode()
        who,expires=decoded.rsplit(':',1)
        return (who==user and int(expires)>time.time() and int(expires)<=time.time()+8*3600+60
                and hmac.compare_digest(value,token(user,password,int(expires))))
    except (ValueError,UnicodeDecodeError):
        return False


async def protect(request,call_next):
    if not serverless():
        return await call_next(request)
    headers={'Cache-Control':'private, no-store','WWW-Authenticate':f'Basic realm="{REALM}", charset="UTF-8"'}
    user,password=credentials()
    if not user or len(password)<24:
        return JSONResponse({'error':{'code':'DEMO_AUTH_NOT_CONFIGURED','message':'Private demo access is not configured. Set server-only MOVATE_DEMO_USERNAME and a MOVATE_DEMO_PASSWORD of at least 24 characters, then redeploy.'}},status_code=503,headers={'Cache-Control':'no-store'})
    if not accepted(request):
        return JSONResponse({'error':{'code':401,'message':'Sign in to the private demo through /api/auth/login.'}},status_code=401,headers=headers)
    # Cookie/basic credentials are not a cross-site write authorization mechanism.
    origin=request.headers.get('origin')
    origin_url=urlsplit(origin) if origin else None
    if request.method not in {'GET','HEAD','OPTIONS'} and origin_url and (origin_url.netloc != request.headers.get('host','') or origin_url.scheme not in {'http','https'}):
        return JSONResponse({'error':{'code':403,'message':'Cross-origin writes are not allowed.'}},status_code=403)
    if request.url.path=='/api/auth/login':
        next_path=request.query_params.get('next','/')
        if not next_path.startswith('/') or next_path.startswith('//') or chr(92) in next_path or any(ord(c)<32 for c in next_path):
            next_path='/'
        response=RedirectResponse(next_path,status_code=303)
        response.set_cookie(COOKIE,token(user,password,int(time.time())+8*3600),max_age=8*3600,httponly=True,secure=True,samesite='strict',path='/api')
    else:
        response=await call_next(request)
    response.headers['Cache-Control']='private, no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['X-Movate-Persistence']='browser-local'
    return response


class VercelPathMiddleware:
    """Restore explicitly forwarded API paths regardless of runtime rewrite path semantics."""
    def __init__(self,app):
        self.app=app

    async def __call__(self,scope,receive,send):
        if scope['type']=='http':
            pairs=parse_qsl(scope.get('query_string',b'').decode(),keep_blank_values=True)
            forwarded=next((v for k,v in pairs if k=='__movate_path'),None)
            if forwarded is not None:
                if forwarded != '/api' and not forwarded.startswith('/api/'):
                    await JSONResponse({'error':{'code':400,'message':'Invalid API forwarding path'}},status_code=400)(scope,receive,send)
                    return
                scope={**scope,'path':forwarded,'raw_path':forwarded.encode(),'query_string':urlencode([(k,v) for k,v in pairs if k!='__movate_path']).encode()}
        await self.app(scope,receive,send)
