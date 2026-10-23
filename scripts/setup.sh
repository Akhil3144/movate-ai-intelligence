#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -c 'import sys; assert sys.version_info >= (3,10), "Python 3.10+ is required"'
node -e 'if(Number(process.versions.node.split(".")[0])<22 || (Number(process.versions.node.split(".")[0])===22 && Number(process.versions.node.split(".")[1])<12)) throw Error("Node 22+ is required")'
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
npm --prefix frontend install
if [ ! -f .env ]; then cp .env.example .env; fi
.venv/bin/python -m backend.data
printf '\nReady. Run npm run dev\n'
