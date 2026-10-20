import { createClient } from '@supabase/supabase-js';
export const configured=Boolean(__SUPABASE_URL__&&__SUPABASE_KEY__);
export const supabase=configured?createClient(__SUPABASE_URL__,__SUPABASE_KEY__,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'meu-trabalho-online-auth'}}):null;
export const returnUrl=()=>new URL('./',window.location.href.split('#')[0].split('?')[0]).href;
export function requireClient(){if(!supabase)throw new Error('A tela está pronta. Falta conectar o novo projeto do Supabase para habilitar as contas.');return supabase;}
