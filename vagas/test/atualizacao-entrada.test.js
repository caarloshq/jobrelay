import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const vagas = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(vagas, 'data/testes-atualizacao-entrada'); fs.mkdirSync(base,{recursive:true});
function fixture(t,status='aguardando_confirmacao') {
  const raiz=fs.mkdtempSync(path.join(base,'caso-')); t.after(()=>fs.rmSync(raiz,{recursive:true,force:true}));
  for(const p of ['vagas/scripts','vagas/src','vagas/data'])fs.mkdirSync(path.join(raiz,p),{recursive:true});
  fs.writeFileSync(path.join(raiz,'vagas/package.json'),' {"type":"module"}');
  for(const p of ['scripts/executar.mjs','src/onboarding-humano.js','src/regras-projeto-leitura.js'])fs.copyFileSync(path.join(vagas,p),path.join(raiz,'vagas',p));
  fs.writeFileSync(path.join(raiz,'vagas/src/onboarding-autonomia.js'),"throw new Error('GRAFO_ANTIGO_IMPORTADO');");
  fs.writeFileSync(path.join(raiz,'vagas/src/versao.js'),"export default 'antiga';");
  fs.writeFileSync(path.join(raiz,'vagas/src/coletar.js'),"import v from './versao.js'; console.log('OPERACAO_'+v);");
  fs.writeFileSync(path.join(raiz,'vagas/src/atualizacao.js'),`import fs from 'node:fs';import path from 'node:path';export async function atualizarAutomaticamente({raiz}){fs.writeFileSync(path.join(raiz,'vagas/src/versao.js'),"export default 'nova';");console.log('UPDATE_CHAMADO');return {status:'${status}'};}export function podeIniciarOperacao(r){return ['atualizado','sem_atualizacao','desativada'].includes(r.status);}`);
  fs.writeFileSync(path.join(raiz,'vagas/data/onboarding-humano.json'),JSON.stringify({versao:1,origem:'html-local',confirmadoPelaPessoa:true,concluidoEm:new Date().toISOString(),passos:[1,2,3,4,5,6,7]}));
  const rodar=env=>spawnSync(process.execPath,[path.join(raiz,'vagas/scripts/executar.mjs'),'rodada'],{encoding:'utf8',env:{PATH:process.env.PATH||'',...env}});
  return {raiz,rodar};
}
test('entrada aguarda confirmação sem importar operação',t=>{const f=fixture(t);const r=f.rodar();assert.notEqual(r.status,0);assert.match(r.stdout,/aguardando_confirmacao/);assert.doesNotMatch(r.stdout,/OPERACAO_/);});
test('entrada importa o código novo depois de atualizar sem cache operacional antigo',t=>{const f=fixture(t,'atualizado');const r=f.rodar();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/OPERACAO_nova/);assert.doesNotMatch(r.stderr,/GRAFO_ANTIGO/);});
test('onboarding humano é exigido antes da consulta de atualização',t=>{const f=fixture(t);fs.unlinkSync(path.join(f.raiz,'vagas/data/onboarding-humano.json'));const r=f.rodar();assert.notEqual(r.status,0);assert.match(r.stderr,/ONBOARDING_HUMANO_OBRIGATORIO/);assert.doesNotMatch(r.stdout,/UPDATE_CHAMADO/);});
test('dados alternativos bloqueiam checagem ativa; opt-out preserva destino configurável',t=>{const f=fixture(t);const dados=path.join(f.raiz,'dados-alternativos');fs.mkdirSync(dados);fs.copyFileSync(path.join(f.raiz,'vagas/data/onboarding-humano.json'),path.join(dados,'onboarding-humano.json'));let r=f.rodar({VAGAS_DIR_DADOS:dados});assert.notEqual(r.status,0);assert.match(r.stdout,/DADOS_OPERACAO_DIVERGENTES/);assert.doesNotMatch(r.stdout,/UPDATE_CHAMADO/);fs.writeFileSync(path.join(dados,'politica-autonomia.json'),JSON.stringify({atualizarAutomaticamente:false}));r=f.rodar({VAGAS_DIR_DADOS:dados});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/OPERACAO_antiga/);assert.doesNotMatch(r.stdout,/UPDATE_CHAMADO/);});
