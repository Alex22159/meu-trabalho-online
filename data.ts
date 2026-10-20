import { requireClient } from './supabase';
import { applyCommand, parseCommand, type Command, type Snapshot } from './model';
export async function loadWork():Promise<Snapshot>{
  const {data,error}=await requireClient().rpc('load_work_state');
  if(error)throw new Error(error.code==='PGRST202'?'O banco deste app ainda precisa ser configurado.':'Não foi possível carregar seus registros. Confira sua conexão e tente novamente.');
  return data as Snapshot;
}
export async function saveWork(command:Command):Promise<Snapshot>{
  const client=requireClient(),valid=parseCommand(command);
  for(let attempt=0;attempt<5;attempt++){
    const current=await loadWork(),next=applyCommand(current.data,valid);
    if(next===current.data)return current;
    const {data,error}=await client.rpc('commit_work_state',{expected_revision:current.revision,next_payload:next,command_id:valid.id});
    if(!error)return data as Snapshot;
    if(error.code!=='40001')throw new Error(error.code==='42501'?'Entre novamente para salvar.':'Não foi possível confirmar o salvamento. Tente novamente.');
  }
  throw new Error('Outro aparelho está salvando. Atualize e tente novamente.');
}
