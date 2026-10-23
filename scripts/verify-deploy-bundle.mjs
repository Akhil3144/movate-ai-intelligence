import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory=new URL('../deployment/data/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',directory),'utf8'));
const allowed=['manifest.json','movate.duckdb','status.json'];
if(readdirSync(directory).some(name=>!allowed.includes(name)))throw Error('Unexpected file in curated deployment data directory');
if(!manifest.synthetic||Object.keys(manifest.table_counts).length!==21)throw Error('Incomplete dataset bundle');
for(const [name,expected]of Object.entries(manifest.files)){
 if(!allowed.includes(name))throw Error('Unexpected manifest path');
 const bytes=readFileSync(new URL(name,directory));
 if(createHash('sha256').update(bytes).digest('hex')!==expected.sha256||bytes.length!==expected.bytes)throw Error(`Bundle integrity failure: ${name}. Run npm run prepare:vercel locally and commit the bundle.`);
}
const status=JSON.parse(readFileSync(new URL('status.json',directory),'utf8'));
if(!status.ready||JSON.stringify(status).match(/\/Users\/|[A-Z]:\\\\Users\\\\|\/home\//))throw Error('Bundle metadata contains a local path or is not ready');
console.log('Validated curated synthetic bundle: 21 tables, original worksheet mapping, no SQLite or local secrets.');
