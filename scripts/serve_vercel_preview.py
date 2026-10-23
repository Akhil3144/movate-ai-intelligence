"""Local production-bundle harness; no Vercel project, account, deployment or publication."""
import argparse
import json
import os
from pathlib import Path
import secrets
import sys
from urllib.parse import parse_qsl,urlencode
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))


def start():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=5174)
    parser.add_argument('--credentials-file',default='/private/tmp/movate-vercel-preview.json')
    args=parser.parse_args()
    os.environ['MOVATE_SERVERLESS']='1'
    os.environ['MOVATE_DEMO_USERNAME']='local-preview-only'
    os.environ['MOVATE_DEMO_PASSWORD']=secrets.token_urlsafe(32)
    credentials=Path(args.credentials_file)
    with os.fdopen(os.open(credentials,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600),'w') as file:
        json.dump({'username':os.environ['MOVATE_DEMO_USERNAME'],'password':os.environ['MOVATE_DEMO_PASSWORD']},file)
    from api.index import app
    from starlette.responses import FileResponse
    import uvicorn
    static=Path(__file__).resolve().parents[1]/'frontend/dist'
    if not (static/'index.html').exists():
        raise RuntimeError('Build first: MOVATE_SERVERLESS=1 npm run build:vercel')

    async def preview(scope,receive,send):
        if scope['type']!='http':
            await app(scope,receive,send)
            return
        path=scope['path']
        if path=='/api' or path.startswith('/api/'):
            # Emulate vercel.json forwarding to the single Python function, preserving original queries.
            pairs=[(k,v) for k,v in parse_qsl(scope.get('query_string',b'').decode(),keep_blank_values=True) if k!='__movate_path']
            pairs.append(('__movate_path',path))
            forwarded={**scope,'path':'/api/index','raw_path':b'/api/index','query_string':urlencode(pairs).encode()}
            await app(forwarded,receive,send)
            return
        asset=(static/path.lstrip('/')).resolve()
        if not asset.is_relative_to(static.resolve()) or not asset.is_file():
            asset=static/'index.html'
        await FileResponse(asset)(scope,receive,send)
    print(f'Production-bundle harness: http://127.0.0.1:{args.port}; temporary test credentials file created (not printed).',flush=True)
    uvicorn.run(preview,host='127.0.0.1',port=args.port)


if __name__=='__main__':start()
