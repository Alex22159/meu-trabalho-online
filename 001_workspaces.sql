-- Executar no projeto NOVO do Supabase reservado para este aplicativo.
begin;

create table public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon, authenticated;
grant select on public.workspaces to authenticated;
create policy "Cada pessoa consulta somente seus registros"
  on public.workspaces for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.work_money_valid(value jsonb, allow_zero boolean default false)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'number' and value::text ~ '^[0-9]+$'
    then value::numeric between (case when allow_zero then 0 else 1 end) and 100000000
    else false end;
$$;

create function public.work_text_valid(value jsonb, max_length integer)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'string'
    and length(btrim(value #>> '{}')) between 1 and max_length, false);
$$;

create function public.validate_work_payload(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  person jsonb;
  entry jsonb;
  prefs jsonb;
begin
  if jsonb_typeof(value) is distinct from 'object'
    or jsonb_typeof(value->'people') is distinct from 'array'
    or jsonb_typeof(value->'entries') is distinct from 'array'
    or jsonb_typeof(value->'settings') is distinct from 'object'
    or octet_length(value::text) > 10000000 then return false; end if;
  if jsonb_array_length(value->'people') > 500
    or jsonb_array_length(value->'entries') > 30000 then return false; end if;

  prefs := value->'settings';
  if not public.work_text_valid(prefs->'title',45)
    or not public.work_text_valid(prefs->'normalLabel',24)
    or not public.work_text_valid(prefs->'vipLabel',24)
    or not public.work_money_valid(prefs->'normalRate')
    or not public.work_money_valid(prefs->'vipRate') then return false; end if;

  for person in select * from jsonb_array_elements(value->'people') loop
    if jsonb_typeof(person) is distinct from 'object'
      or not public.work_text_valid(person->'id',80)
      or not public.work_text_valid(person->'name',60)
      or not public.work_text_valid(person->'color',7)
      or (person->>'id') !~ '^[a-zA-Z0-9_-]+$'
      or (person->>'color') !~ '^#[0-9A-Fa-f]{6}$'
      or not public.work_money_valid(person->'normal')
      or not public.work_money_valid(person->'vip') then return false; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(value->'people') p group by p->>'id' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(value->'people') p group by lower(btrim(p->>'name')) having count(*)>1)
    then return false; end if;

  for entry in select * from jsonb_array_elements(value->'entries') loop
    if jsonb_typeof(entry) is distinct from 'object'
      or not public.work_text_valid(entry->'id',80)
      or (entry->>'id') !~ '^[a-zA-Z0-9_-]+$'
      or not public.work_text_valid(entry->'person',80)
      or not public.work_text_valid(entry->'date',10)
      or (entry->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or not public.work_text_valid(entry->'kind',6)
      or entry->>'kind' not in ('normal','vip')
      or not public.work_text_valid(entry->'shift',60)
      or jsonb_typeof(entry->'note') is distinct from 'string'
      or length(entry->>'note') > 300
      or not public.work_money_valid(entry->'amount')
      or not public.work_money_valid(entry->'received',true)
      then return false; end if;
    if (entry->>'date')::date not between date '1900-01-01' and date '2200-12-31'
      or to_char((entry->>'date')::date,'YYYY-MM-DD') <> entry->>'date'
      or (entry->>'received')::numeric > (entry->>'amount')::numeric
      or not exists(select 1 from jsonb_array_elements(value->'people') p where p->>'id'=entry->>'person')
      then return false; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(value->'entries') e group by e->>'id' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(value->'entries') e
      group by e->>'person',e->>'date',e->>'kind',lower(btrim(e->>'shift')) having count(*)>1)
      then return false; end if;
  return true;
exception when others then return false;
end;
$$;

create function public.load_work_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  result public.workspaces;
begin
  if owner_id is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  insert into public.workspaces(user_id,payload)
    values (owner_id,'{"people":[],"entries":[],"settings":{"title":"Meu Trabalho","normalLabel":"Normal","vipLabel":"VIP","normalRate":38000,"vipRate":65000},"applied":[]}'::jsonb)
    on conflict(user_id) do nothing;
  select * into result from public.workspaces where user_id=owner_id;
  return jsonb_build_object('revision',result.revision,'data',result.payload);
end;
$$;

create function public.commit_work_state(expected_revision bigint, next_payload jsonb, command_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  current_row public.workspaces;
  clean_payload jsonb;
  recent_ids jsonb;
begin
  if owner_id is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  if command_id is null or expected_revision is null or expected_revision < 0 then raise exception 'Operação inválida' using errcode='22023'; end if;
  perform public.load_work_state();
  select * into current_row from public.workspaces where user_id=owner_id for update;
  if current_row.payload->'applied' ? command_id::text then
    return jsonb_build_object('revision',current_row.revision,'data',current_row.payload);
  end if;
  if current_row.revision <> expected_revision then
    raise exception 'Os dados mudaram em outro aparelho' using errcode='40001';
  end if;
  if not public.validate_work_payload(next_payload) then
    raise exception 'Registros inválidos' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(item order by position),'[]'::jsonb) into recent_ids
    from jsonb_array_elements((current_row.payload->'applied') || jsonb_build_array(command_id::text))
      with ordinality as items(item,position)
    where position > greatest(0,jsonb_array_length(current_row.payload->'applied')+1-100);
  clean_payload := jsonb_build_object('people',next_payload->'people','entries',next_payload->'entries',
    'settings',next_payload->'settings','applied',recent_ids);
  update public.workspaces set payload=clean_payload,revision=revision+1,updated_at=now() where user_id=owner_id;
  return jsonb_build_object('revision',current_row.revision+1,'data',clean_payload);
end;
$$;

revoke all on function public.work_money_valid(jsonb,boolean) from public,anon,authenticated;
revoke all on function public.work_text_valid(jsonb,integer) from public,anon,authenticated;
revoke all on function public.validate_work_payload(jsonb) from public,anon,authenticated;
revoke all on function public.load_work_state() from public,anon;
revoke all on function public.commit_work_state(bigint,jsonb,uuid) from public,anon;
grant execute on function public.load_work_state() to authenticated;
grant execute on function public.commit_work_state(bigint,jsonb,uuid) to authenticated;
commit;
