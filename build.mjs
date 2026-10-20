import { build } from 'esbuild';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const publicConfig=existsSync('supabase.public.json')?JSON.parse(readFileSync('supabase.public.json','utf8')):{};
const url=process.env.SUPABASE_URL||publicConfig.url||'',key=process.env.SUPABASE_PUBLISHABLE_KEY||publicConfig.publishableKey||'';
if(Boolean(url)!==Boolean(key))throw new Error('Preencha a URL e a chave publicável do mesmo projeto.');
if(url&&!/^https:\/\/[^\s/]+\/?$/.test(url))throw new Error('A URL do Supabase precisa usar HTTPS e não conter caminhos.');
if(key){
  let isPublic=key.startsWith('sb_publishable_');
  if(key.startsWith('eyJ')){try{isPublic=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{isPublic=false;}}
  if(!isPublic)throw new Error('Use somente a chave publicável ou anon. Chaves secretas não podem ir para o navegador.');
}
if(process.env.REQUIRE_SUPABASE_CONFIG==='1'&&(!url||!key))throw new Error('Configure as variáveis públicas do Supabase antes de publicar.');
mkdirSync('dist/assets',{recursive:true});
await build({entryPoints:['src/entry.tsx'],outfile:'dist/assets/app.js',bundle:true,minify:true,platform:'browser',target:['es2022'],jsx:'automatic',define:{'process.env.NODE_ENV':'"production"',__SUPABASE_URL__:JSON.stringify(url),__SUPABASE_KEY__:JSON.stringify(key)}});
writeFileSync('dist/assets/app.css',readFileSync('src/app.css','utf8')+'\n'+readFileSync('src/auth.css','utf8'));
copyFileSync('public/favicon.svg','dist/favicon.svg');
writeFileSync('dist/.nojekyll','');
writeFileSync('dist/index.html','<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#172b42"><meta name="description" content="Seu calendário de trabalho, seus contratantes e recebimentos. Entre na sua conta."><title>Meu Trabalho — sua conta, sua rotina</title><link rel="icon" href="./favicon.svg"><link rel="stylesheet" href="./assets/app.css"></head><body><div id="app"></div><script src="./assets/app.js" defer></script></body></html>');
console.log(url?'App compilado com Supabase configurado.':'Prévia compilada. A conexão do Supabase está pendente.');
