"""One-command local startup, with port checks and clean process shutdown."""
import os
import signal
import socket
import subprocess
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
python=ROOT/('.venv/Scripts/python.exe' if os.name=='nt' else '.venv/bin/python')
if not python.exists() or not (ROOT/'frontend/node_modules').is_dir():
    sys.exit('Dependencies missing. Run bash scripts/setup.sh (see README for Windows).')
# Read only server port values without a runtime dependency in the launcher.
settings={}
if (ROOT/'.env').exists():
    for line in (ROOT/'.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key,value=line.split('=',1)
            settings[key.strip()]=value.strip().strip('"').strip("'")
backend=os.getenv('BACKEND_PORT',settings.get('BACKEND_PORT','8000'))
frontend=os.getenv('FRONTEND_PORT',settings.get('FRONTEND_PORT','5173'))
for port in [backend,frontend]:
    try:
        with socket.socket() as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(('127.0.0.1',int(port)))
    except PermissionError:
        sys.exit(f'Permission denied binding localhost:{port}. Allow local network/server access in your terminal environment.')
    except OSError:
        sys.exit(f'Port {port} is occupied. Stop the existing service or set BACKEND_PORT/FRONTEND_PORT in .env.')
children=[]
def stop(*args):
    for child in children:
        if child.poll() is None:
            child.terminate()
    for child in children:
        try: child.wait(timeout=8)
        except subprocess.TimeoutExpired: child.kill()
signal.signal(signal.SIGINT,stop)
signal.signal(signal.SIGTERM,stop)
try:
    env={**os.environ,'BACKEND_PORT':backend}
    children.append(subprocess.Popen([str(python),'-m','uvicorn','backend.main:app','--reload','--reload-dir','backend','--host','127.0.0.1','--port',backend],env=env))
    children.append(subprocess.Popen(['npm.cmd' if os.name=='nt' else 'npm','--prefix','frontend','run','dev','--','--port',frontend],env=env))
    print(f'\nMovate: http://127.0.0.1:{frontend} | API: http://127.0.0.1:{backend}/docs\n',flush=True)
    import time
    while all(c.poll() is None for c in children):
        time.sleep(.5)
finally:
    stop()
