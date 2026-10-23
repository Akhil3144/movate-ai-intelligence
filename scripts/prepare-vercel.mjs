import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const python=process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python';
const result=spawnSync(python,['scripts/prepare_vercel.py'],{cwd:root,stdio:'inherit'});
if(result.error)console.error('Create the local Python environment first: bash scripts/setup.sh');
process.exit(result.status??1);
