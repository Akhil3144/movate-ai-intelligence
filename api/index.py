"""Vercel's supported Python ASGI entry point. No Uvicorn server runs in the function."""
import os
os.environ['MOVATE_SERVERLESS'] = '1'
from backend.main import app
from backend.access import VercelPathMiddleware
app.add_middleware(VercelPathMiddleware)
