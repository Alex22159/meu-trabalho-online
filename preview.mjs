import http from 'node:http';
import { readFileSync } from 'node:fs';
const files={'/':'dist/index.html','/assets/app.js':'dist/assets/app.js','/assets/app.css':'dist/assets/app.css','/favicon.svg':'dist/favicon.svg'};
http.createServer((req,res)=>{const file=files[new URL(req.url,'http://127.0.0.1').pathname];if(!file){res.writeHead(404);return res.end();}try{const type=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html';res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});res.end(readFileSync(file));}catch{res.writeHead(503);res.end('Compile o app antes de abrir a prévia.');}}).listen(5174,'127.0.0.1',()=>console.log('Prévia do app online: http://127.0.0.1:5174/'));
