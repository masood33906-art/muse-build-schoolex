// Run with tsx so TS data files can be imported: npx tsx scripts/generate-seed.mjs
import fs from 'fs'; import path from 'path'; import {fileURLToPath} from 'url';
const root=path.dirname(fileURLToPath(import.meta.url))+'/..';
const s=await import(path.join(root,'src/data/initialStudents.ts'));
const st=await import(path.join(root,'src/data/initialStaff.ts'));
const c=await import(path.join(root,'src/data/initialClasses.ts'));
const pick=(a,b)=> (a&&a.length?a:b||[]);
const seed={students:pick(s.INITIAL_STUDENTS,s.ARCHIVED_INITIAL_STUDENTS),staff:pick(st.INITIAL_STAFF,st.ARCHIVED_INITIAL_STAFF),classes:pick(c.INITIAL_CLASSES,c.ARCHIVED_INITIAL_CLASSES)};
fs.writeFileSync(path.join(root,'server/seed-data.json'), JSON.stringify(seed,null,1));
console.log('seed counts', Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,v.length])));
