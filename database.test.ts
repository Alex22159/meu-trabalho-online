import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applyCommand, type Snapshot } from '../src/model.ts';

test('database migration enforces account separation, atomic revisions and validation',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to anon,authenticated;`);
    await db.exec(readFileSync(new URL('../supabase/migrations/001_workspaces.sql',import.meta.url),'utf8'));
    const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users(id) values ($1),($2)',[a,b]);
    async function asUser(id:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
    const load=async()=> (await db.query<{value:Snapshot}>('select public.load_work_state() as value')).rows[0].value;
    const commit=async(state:Snapshot,next:unknown,id:string)=>(await db.query<{value:Snapshot}>('select public.commit_work_state($1,$2::jsonb,$3::uuid) as value',[state.revision,JSON.stringify(next),id])).rows[0].value;
    await asUser(a);
    const first=await load();assert.equal(first.data.people.length,0);
    const id1='33333333-3333-4333-8333-333333333333';
    const registered=applyCommand(first.data,{id:id1,action:'person.save',value:{id:'alex',name:'Alex',normal:38000,vip:65000,color:'#3377cc'}});
    const saved=await commit(first,registered,id1);assert.equal(saved.revision,1);assert.equal(saved.data.people.length,1);
    const retry=await commit(first,registered,id1);assert.deepEqual(retry,saved);
    await assert.rejects(()=>commit(first,registered,'44444444-4444-4444-8444-444444444444'),/mudaram/);
    await assert.rejects(()=>db.query("update public.workspaces set revision=99"),/permission denied/);
    const rowA=await db.query('select user_id from public.workspaces');assert.equal(rowA.rows.length,1);
    await asUser(b);
    const other=await load();assert.equal(other.data.people.length,0);
    const rowsB=await db.query<{user_id:string}>('select user_id from public.workspaces');assert.deepEqual(rowsB.rows.map(r=>r.user_id),[b]);
    await commit(other,other.data,'55555555-5555-4555-8555-555555555555');
    await asUser(a);const current=await load();assert.equal(current.data.people.length,1);
    const malformed=structuredClone(current.data);malformed.entries.push({id:'bad',person:'missing',date:'2026-10-20',kind:'normal',shift:'Noite',amount:38000,received:0,note:''});
    await assert.rejects(()=>commit(current,malformed,'66666666-6666-4666-8666-666666666666'),/inválidos/);
    assert.equal((await load()).revision,1);
    await db.exec('reset role');await db.exec("set request.jwt.claim.sub='';set role authenticated");
    await assert.rejects(load,/Autenticação necessária/);
    await db.exec('reset role;set role anon');await assert.rejects(load,/permission denied/);
  }finally{await db.close();}
});
