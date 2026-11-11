import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerRegras, registrarRegra, iniciarRegras } from '../src/regras-projeto.js';
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/testes-regras');
test('regras ficam em Markdown, preservam fala e recusam leitura antiga e duplicação', () => {
  fs.mkdirSync(base, { recursive:true }); const raiz=fs.mkdtempSync(path.join(base,'caso-'));
  try {
    fs.mkdirSync(path.join(raiz,'vagas/data'),{recursive:true});
    const primeira=lerRegras(raiz); assert.equal(primeira.existe,false);
    const regra={id:'perguntas-no-final',texto:'Pergunte no final do lote.',fonte:'Pedido explícito nesta instalação',alcance:'Somente perguntas pessoais da rodada',hashEsperado:primeira.hash};
    const r=registrarRegra(raiz,regra); assert.equal(r.registrado,true);
    assert.match(lerRegras(raiz).texto,/Pergunte no final do lote/);
    assert.throws(()=>registrarRegra(raiz,{...regra,id:'outra-regra'}),/REGRAS_CONFLITO/);
    assert.throws(()=>registrarRegra(raiz,{...regra,hashEsperado:r.hash}),/REGRAS_ID_EXISTENTE/);
    assert.equal(fs.readdirSync(raiz).includes('regras.json'),false);
  } finally { fs.rmSync(raiz,{recursive:true,force:true}); }
});
test('regras recusam symlink',()=>{
  fs.mkdirSync(base,{recursive:true}); const raiz=fs.mkdtempSync(path.join(base,'link-'));
  try { fs.writeFileSync(path.join(raiz,'original.md'),'preservar');fs.symlinkSync(path.join(raiz,'original.md'),path.join(raiz,'REGRAS-DO-PROJETO.md'));assert.throws(()=>lerRegras(raiz),/INSEGURO/); } finally {fs.rmSync(raiz,{recursive:true,force:true});}
});

test('regras recusam também symlink pendente sem substituir o link',()=>{
 fs.mkdirSync(base,{recursive:true});const raiz=fs.mkdtempSync(path.join(base,'pendente-'));
 try {const alvo=path.join(raiz,'REGRAS-DO-PROJETO.md');fs.symlinkSync(path.join(raiz,'inexistente.md'),alvo);assert.throws(()=>lerRegras(raiz),/INSEGURO/);assert.equal(fs.lstatSync(alvo).isSymbolicLink(),true);} finally{fs.rmSync(raiz,{recursive:true,force:true});}
});

test('primeira leitura operacional cria modelo neutro e nunca sobrescreve regras',()=>{
 fs.mkdirSync(base,{recursive:true});const raiz=fs.mkdtempSync(path.join(base,'iniciar-'));
 try{fs.mkdirSync(path.join(raiz,'vagas/data'),{recursive:true});const a=iniciarRegras(raiz);assert.equal(a.existe,true);assert.equal(iniciarRegras(raiz).hash,a.hash);assert.match(a.texto,/Regras não concedem/);}finally{fs.rmSync(raiz,{recursive:true,force:true});}
});
