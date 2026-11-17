import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { apresentarAtualizacaoConferida } from '../src/mensagem-atualizacao.js';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
async function fixture(t, nota='DATA_PUBLICACAO') {
 const raiz=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'jobrelay-mensagem-')));t.after(()=>fs.rmSync(raiz,{recursive:true,force:true}));
 const dir=path.join(raiz,'vagas/src/compat-layout');fs.mkdirSync(dir,{recursive:true});
 fs.copyFileSync(fileURLToPath(new URL('../../vagas/src/compat-layout/bootstrap.mjs',import.meta.url)),path.join(dir,'bootstrap.mjs'));
 const arquivos=[['core/package.json',JSON.stringify({version:'1.6.0'})],['docs/releases/v1.6.0.md',nota]].map(([nome,texto])=>({nome,conteudo:Buffer.from(texto).toString('base64'),sha256:hash(texto),modo:0o644}));
 const bytes=Buffer.from(JSON.stringify({contrato:1,versao:'1.6.0',arquivos,modelos:{},legados:[],anteriores:[]}));fs.writeFileSync(path.join(dir,'conteudo.json'),bytes);fs.writeFileSync(path.join(dir,'conteudo.sha256'),hash(bytes));
 const {bootstrap}=await import(pathToFileURL(path.join(dir,'bootstrap.mjs')));bootstrap(raiz);
 fs.writeFileSync(path.join(raiz,'local/data/atualizacao-instalacao.json'),JSON.stringify({tag:'v1.6.0',tagSha:'a'.repeat(40),assetSha256:'b'.repeat(64),arquivos:[{nome:'vagas/src/compat-layout/conteudo.json',sha256:hash(bytes)}]}));
 return raiz;
}
test('pós-checagem usa bootstrap real, nota da tag exata e mostra uma vez',async t=>{
 const raiz=await fixture(t);const textos=[];const body='# Release real\n\n17/11/2026\n\nTexto integral.';
 const fetch=async url=>({ok:true,json:async()=>url.includes('/git/ref/')?{object:{sha:'a'.repeat(40)}}:{tag_name:'v1.6.0',draft:false,prerelease:false,published_at:'2026-11-17T12:00:00Z',body}});
 assert.equal((await apresentarAtualizacaoConferida({raiz,fetch,saida:s=>textos.push(s)})).apresentada,true);
 assert.ok(textos[0].replace(/^> ?/gm, '').includes(body));assert.doesNotMatch(textos[0],/DATA_PUBLICACAO/);
 assert.equal((await apresentarAtualizacaoConferida({raiz,fetch,saida:s=>textos.push(s)})).apresentada,false);assert.equal(textos.length,1);
});
test('nota indisponível ou tag divergente nunca fabrica sucesso',async t=>{
 const raiz=await fixture(t);const saida=()=>assert.fail('não deve anunciar conclusão');
 assert.equal((await apresentarAtualizacaoConferida({raiz,saida,fetch:async()=>({ok:false})})).apresentada,false);
 assert.equal((await apresentarAtualizacaoConferida({raiz,saida,fetch:async()=>({ok:true,json:async()=>({tag_name:'v1.5.3',object:{sha:'c'.repeat(40)}})})})).apresentada,false);
});
test('código alterado após instalação impede pós-checagem e mensagem',async t=>{
 const raiz=await fixture(t,'Nota real');fs.writeFileSync(path.join(raiz,'core/package.json'),'{}');
 await assert.rejects(apresentarAtualizacaoConferida({raiz,saida:()=>assert.fail()}),/PONTE_CODIGO_CANONICO_MODIFICADO/);
});

test('duas entradas concorrentes exibem a nota uma única vez',async t=>{
 const raiz=await fixture(t);let exibidas=0;
 const fetch=async url=>{await new Promise(r=>setTimeout(r,20));return {ok:true,json:async()=>url.includes('/git/ref/')?{object:{sha:'a'.repeat(40)}}:{tag_name:'v1.6.0',draft:false,prerelease:false,published_at:'2026-11-17T12:00:00Z',body:'Nota da release'} };};
 const r=await Promise.all([1,2].map(()=>apresentarAtualizacaoConferida({raiz,fetch,saida:()=>exibidas++})));
 assert.equal(exibidas,1);assert.equal(r.filter(x=>x.apresentada).length,1);
});
test('trava existente e diretório externo não são contornados',async t=>{
 const raiz=await fixture(t);const dados=path.join(raiz,'local/data');fs.mkdirSync(path.join(dados,'.mensagem-atualizacao.lock'));
 assert.equal((await apresentarAtualizacaoConferida({raiz,saida:()=>assert.fail()})).apresentacaoOcupada,true);
 fs.rmdirSync(path.join(dados,'.mensagem-atualizacao.lock'));const externo=fs.mkdtempSync(path.join(os.tmpdir(),'jobrelay-externo-'));t.after(()=>fs.rmSync(externo,{recursive:true,force:true}));fs.renameSync(dados,dados+'-preservado');fs.symlinkSync(externo,dados);
 await assert.rejects(apresentarAtualizacaoConferida({raiz,saida:()=>assert.fail()}),/MENSAGEM_CAMINHO_INSEGURO/);assert.deepEqual(fs.readdirSync(externo),[]);
});
