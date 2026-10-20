import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, applyCommand, annualSummary, parseCommand, validDate } from '../src/model.ts';
const person={id:'alex',name:'Alex',normal:38000,vip:65000,color:'#3377cc'};
const command=(id:string,action:Parameters<typeof applyCommand>[1]['action'],value:unknown)=>({id,action,value});
const entry=(id:string,date:string,kind='normal')=>({id,person:'alex',date,kind,shift:'Noite',amount:38000,received:10000,note:''});
const registered=()=>applyCommand(emptyData(),command('person','person.save',person));
test('annual totals include previous months and both kinds, but separate years and unique days',()=>{
  let data=registered();for(const [i,date,kind] of [[1,'2026-01-10','normal'],[2,'2026-09-10','normal'],[3,'2026-10-10','vip'],[4,'2026-10-10','normal'],[5,'2025-12-10','normal']] as const)data=applyCommand(data,command('command'+i,'entry.save',entry('entry'+i,date,kind)));
  assert.deepEqual(annualSummary(data,'2026'),{amount:152000,received:40000,pending:112000,days:3,count:4});
  assert.equal(annualSummary(data,'2025').days,1);
});
test('clear removes all entries in all years and retains names, rates, colors and settings',()=>{
  let data=registered();data=applyCommand(data,command('one','entry.save',entry('one','2025-12-10')));data=applyCommand(data,command('two','entry.save',entry('two','2026-10-10','vip')));
  assert.throws(()=>applyCommand(data,command('bad','entries.clear',{confirmation:'apagar'})));
  for(const confirmation of ['limpar','LIMPAR','Limpar','lImPaR',' limpar ']){
    const result=applyCommand(data,command('case-'+confirmation.trim(),'entries.clear',{confirmation}));
    assert.equal(result.entries.length,0);assert.deepEqual(result.people,data.people);
  }
  const cleared=applyCommand(data,command('clear','entries.clear',{confirmation:'LIMPAR'}));
  assert.equal(cleared.entries.length,0);assert.deepEqual(cleared.people,data.people);assert.deepEqual(cleared.settings,data.settings);assert.equal(data.entries.length,2);
});
test('payments are additive, idempotent under retry and cannot exceed remaining balance',()=>{
  let data=applyCommand(registered(),command('entry','entry.save',entry('one','2026-10-10')));
  const receive=command('payment','entry.receive',{id:'one',amount:5000});data=applyCommand(data,receive);assert.equal(data.entries[0].received,15000);
  assert.deepEqual(applyCommand(data,receive),data);
  data=applyCommand(data,command('other-device','entry.receive',{id:'one',amount:5000}));assert.equal(data.entries[0].received,20000);
  assert.throws(()=>applyCommand(data,command('excess','entry.receive',{id:'one',amount:30000})));
});
test('editing on an old device cannot overwrite a payment received on another device',()=>{
  let data=applyCommand(registered(),command('entry','entry.save',entry('one','2026-10-10')));
  const before=structuredClone(data.entries[0]);
  data=applyCommand(data,command('payment','entry.receive',{id:'one',amount:5000}));
  assert.throws(()=>applyCommand(data,command('old-device','entry.save',{...before,note:'Observação de outro aparelho',before})),/mudou em outro aparelho/);
  const current=structuredClone(data.entries[0]);
  data=applyCommand(data,command('updated-device','entry.save',{...current,note:'Observação conferida',before:current}));
  assert.equal(data.entries[0].received,15000);
});
test('registered names cannot be removed while referenced, and are edited without changing old amounts',()=>{
  let data=applyCommand(registered(),command('entry','entry.save',entry('one','2026-10-10')));
  assert.throws(()=>applyCommand(data,command('delete','person.delete',{id:'alex'})));
  data=applyCommand(data,command('edit-person','person.save',{...person,name:'Alex Empresa',normal:50000}));assert.equal(data.entries[0].amount,38000);
  data=applyCommand(data,command('delete-entry','entry.delete',{id:'one'}));assert.equal(data.people.length,1);
  data=applyCommand(data,command('delete-person','person.delete',{id:'alex'}));assert.equal(data.people.length,0);
});
test('validates dates, cents, contract references and duplicate work',()=>{
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
  let data=registered();data=applyCommand(data,command('entry','entry.save',entry('one','2026-10-10')));
  assert.throws(()=>applyCommand(data,command('duplicate','entry.save',entry('two','2026-10-10'))));
  assert.throws(()=>applyCommand(data,command('orphan','entry.save',{...entry('two','2026-10-11'),person:'missing'})));
  assert.throws(()=>applyCommand(data,command('fraction','entry.save',{...entry('two','2026-10-11'),amount:1.5})));
  assert.throws(()=>applyCommand(data,command('overpaid','entry.save',{...entry('two','2026-10-11'),received:50000})));
  assert.throws(()=>parseCommand({id:'id',action:'unknown',value:{}}));
});
