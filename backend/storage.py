import json
import sqlite3
import uuid
from datetime import datetime,timezone
from .data import STORE
from .runtime import serverless
import logging


def connection():
    if serverless():
        raise RuntimeError('SQLite persistence is disabled in the hosted demo; use browser-local storage.')
    con = sqlite3.connect(STORE / 'workspace.sqlite', timeout=10)
    con.row_factory = sqlite3.Row
    con.executescript('''CREATE TABLE IF NOT EXISTS chats(id TEXT PRIMARY KEY,title TEXT,role TEXT,created_at TEXT);
      CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,chat_id TEXT,kind TEXT,payload TEXT,created_at TEXT);
      CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,role TEXT,payload TEXT,created_at TEXT);
      CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY,role TEXT,event TEXT,context TEXT,created_at TEXT);
      CREATE TRIGGER IF NOT EXISTS immutable_audit_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'Append-only log'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_audit_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'Append-only log'); END;''')
    return con


def now():
    return datetime.now(timezone.utc).isoformat()


def audit(role,event,context=''):
    if serverless():
        logging.getLogger('movate').info(json.dumps({'event':event,'persona':role,'context':context,'persistence':'platform_logs_not_durable_app_storage'}))
        return
    with connection() as c:
        c.execute('INSERT INTO audit_log VALUES(?,?,?,?,?)',(str(uuid.uuid4()),role,event,context,now()))


def chats(role):
    if serverless():
        return []
    with connection() as c:
        return [dict(r) for r in c.execute('SELECT * FROM chats WHERE role=? ORDER BY created_at DESC LIMIT 100',(role,))]


def get_chat(cid,role):
    if serverless():
        return None
    with connection() as c:
        chat = c.execute('SELECT * FROM chats WHERE id=? AND role=?',(cid,role)).fetchone()
        if not chat:
            return None
        return {**dict(chat),'messages':[{'kind':r['kind'],'payload':json.loads(r['payload'])} for r in c.execute('SELECT * FROM messages WHERE chat_id=? ORDER BY created_at LIMIT 200',(cid,))]}


def save_exchange(cid,role,question,answer):
    with connection() as c:
        if not cid:
            cid = str(uuid.uuid4())
            c.execute('INSERT INTO chats VALUES(?,?,?,?)',(cid,question[:90],role,now()))
        for kind,payload in [('user',{'text':question}),('assistant',answer)]:
            c.execute('INSERT INTO messages VALUES(?,?,?,?,?)',(str(uuid.uuid4()),cid,kind,json.dumps(payload),now()))
    return cid
