"""Deployment switches. Normal VS Code development retains its existing local storage."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def serverless():
    return os.getenv('MOVATE_SERVERLESS') == '1' or os.getenv('VERCEL') == '1'


def bundle_dir():
    return Path(os.getenv('MOVATE_BUNDLE_DIR', str(ROOT / 'deployment/data')))
