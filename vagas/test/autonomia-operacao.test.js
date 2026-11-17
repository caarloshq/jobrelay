// Incidente 2 de 16 de Novembro de 2026: operação "ativa" de processo morto travou a Apify
// e só saía com `operar retomar paradaConfirmada` + `encerrar` feitos à mão.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { operar, comEscritaCentral, diagnosticarOperacaoOrfa, _dependencias, LIMITES_ORFA } from '../src/operacao.js';
import { gravarJsonAtomico, lerJsonSeguro } from '../src/persistencia.js';
import { salvarEstado } from '../src/estado-central.js';

const pidMorto = () => spawnSync(process.execPath, ['-e', '0']).pid;
const original = { ..._dependencias };
function cenario(t) {
  const dados = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'autonomia-operacao-')));
  t.after(() => { Object.assign(_dependencias, original); fs.rmSync(dados, { recursive: true, force: true }); });
  Object.assign(_dependencias, original);
  return dados;
}
const estadoDe = dados => lerJsonSeguro(path.join(dados, 'operacao', 'estado.json'));
const gravarEstado = (dados, estado) => gravarJsonAtomico(path.join(dados, 'operacao', 'estado.json'), estado);
const relogio = (ms) => { const base = Date.now(); _dependencias.agoraMs = () => base + ms; return base; };

test('reinício do computador depois do último sinal: a nova rodada começa sem intervenção', t => {
  const dados = cenario(t);
  const primeira = operar(dados, 'iniciar', { dono: 'rodada-antiga' });
  _dependencias.bootMs = () => Date.now() + 3_600_000; // o computador ligou depois do último sinal
  const segunda = operar(dados, 'iniciar', { dono: 'rodada-nova' });
  assert.equal(segunda.recuperouOrfa.motivo, 'reinicio_do_computador');
  assert.equal(segunda.recuperouOrfa.runId, primeira.estado.runId);
  assert.equal(segunda.estado.dono, 'rodada-nova');
  assert.equal(estadoDe(dados).recuperacoes.length, 1);
  // O sinal da operação antiga morreu junto: o token dela não vale mais.
  assert.throws(() => operar(dados, 'reservar', { token: primeira.token, identidade: { canonico: 'x:1' }, etapa: 'busca', dono: 'rodada-antiga' }), /POSSE_NEGADA/);
});

test('operação viva e recente continua bloqueando um segundo início', t => {
  const dados = cenario(t);
  _dependencias.bootMs = () => Date.now() - 86_400_000;
  operar(dados, 'iniciar', { dono: 'rodada-a', pidDono: process.pid });
  relogio(3 * 3_600_000);
  assert.throws(() => operar(dados, 'iniciar', { dono: 'rodada-b' }), /OPERACAO_ATIVA/);
});

test('dono declarado morto: só vira órfã depois de 15 minutos sem sinal', t => {
  const dados = cenario(t);
  _dependencias.bootMs = () => Date.now() - 86_400_000;
  operar(dados, 'iniciar', { dono: 'rodada-a', pidDono: pidMorto() });
  relogio(5 * 60_000);
  assert.throws(() => operar(dados, 'iniciar', { dono: 'rodada-b' }), /OPERACAO_ATIVA/);
  relogio(LIMITES_ORFA.donoMortoSemSinalMs + 1000);
  assert.equal(operar(dados, 'iniciar', { dono: 'rodada-b' }).recuperouOrfa.motivo, 'dono_morto_sem_sinal');
});

test('dono declarado vivo nunca é tomado, por mais tempo que passe', t => {
  const dados = cenario(t);
  _dependencias.bootMs = () => Date.now() - 86_400_000;
  operar(dados, 'iniciar', { dono: 'rodada-a', pidDono: process.pid });
  relogio(48 * 3_600_000);
  assert.equal(diagnosticarOperacaoOrfa(estadoDe(dados)).orfa, false);
  assert.throws(() => operar(dados, 'iniciar', { dono: 'rodada-b' }), /OPERACAO_ATIVA/);
});

test('sem dono declarado: duas horas sem sinal', t => {
  const dados = cenario(t);
  _dependencias.bootMs = () => Date.now() - 86_400_000;
  operar(dados, 'iniciar', { dono: 'rodada-a' });
  relogio(3_600_000);
  assert.throws(() => operar(dados, 'iniciar', { dono: 'rodada-b' }), /OPERACAO_ATIVA/);
  relogio(LIMITES_ORFA.semDonoSemSinalMs + 1000);
  assert.equal(operar(dados, 'iniciar', { dono: 'rodada-b' }).recuperouOrfa.motivo, 'sem_sinal_ha_horas');
});

test('PID de dono inválido é recusado', t => {
  const dados = cenario(t);
  assert.throws(() => operar(dados, 'iniciar', { dono: 'x', pidDono: 'abc' }), /PID_DONO_INVALIDO/);
});

test('escrita legada que morreu no meio (legado:PID morto) não trava a Apify nem a cota', t => {
  const dados = cenario(t);
  _dependencias.bootMs = () => Date.now() - 86_400_000;
  operar(dados, 'iniciar', { dono: 'temporaria' });
  const estado = estadoDe(dados); estado.dono = `legado:${pidMorto()}`; gravarEstado(dados, estado);
  const arquivo = path.join(dados, 'cota-apify.json');
  salvarEstado(arquivo, { dia: '2026-11-16', usos: 1 }, dados);
  assert.deepEqual(lerJsonSeguro(arquivo), { dia: '2026-11-16', usos: 1 });
  assert.equal(estadoDe(dados).status, 'encerrada');
  assert.equal(estadoDe(dados).recuperacoes[0].motivo, 'processo_dono_morto');
});

test('legado de processo vivo continua sendo posse de outro: sem token, recusa', t => {
  const dados = cenario(t);
  _dependencias.bootMs = () => Date.now() - 86_400_000;
  operar(dados, 'iniciar', { dono: 'temporaria' });
  const estado = estadoDe(dados); estado.dono = `legado:${process.pid}`; gravarEstado(dados, estado);
  assert.throws(() => comEscritaCentral(dados, () => 1), /POSSE_NEGADA/);
});

test('trava de escrita de processo morto é retirada; a de processo vivo, não', t => {
  const dados = cenario(t);
  const lock = path.join(dados, 'operacao', '.escrita.lock');
  fs.mkdirSync(lock, { recursive: true });
  gravarJsonAtomico(path.join(lock, 'dono.json'), { pid: process.pid, nonce: 'x', desde: new Date().toISOString() });
  assert.throws(() => comEscritaCentral(dados, () => 1), /ESCRITA_OCUPADA/);
  gravarJsonAtomico(path.join(lock, 'dono.json'), { pid: pidMorto(), nonce: 'x', desde: new Date().toISOString() });
  assert.equal(comEscritaCentral(dados, () => 'gravou'), 'gravou');
  assert.equal(fs.existsSync(lock), false);
});

test('trava criada e nunca assinada só cai depois de dez segundos', t => {
  const dados = cenario(t);
  const lock = path.join(dados, 'operacao', '.escrita.lock');
  fs.mkdirSync(lock, { recursive: true });
  assert.throws(() => comEscritaCentral(dados, () => 1), /ESCRITA_OCUPADA/);
  relogio(LIMITES_ORFA.lockSemDonoMs + 1000);
  assert.equal(comEscritaCentral(dados, () => 'ok'), 'ok');
});

test('operação encerrada nunca é diagnosticada como órfã', () => {
  assert.equal(diagnosticarOperacaoOrfa({ status: 'encerrada', ultimoProgresso: '2020-01-01T00:00:00.000Z' }).orfa, false);
});

test('escritor que leva o PID no nome (apify:PID) morto: encerra na hora; vivo: não é tomado', t => {
  const dados = cenario(t);
  _dependencias.bootMs = () => Date.now() - 86_400_000;
  operar(dados, 'iniciar', { dono: `apify:${process.pid}`, pidDono: process.pid });
  assert.throws(() => operar(dados, 'iniciar', { dono: 'outro' }), /OPERACAO_ATIVA/);
  const estado = estadoDe(dados); estado.dono = `apify:${pidMorto()}`; delete estado.pidDono; gravarEstado(dados, estado);
  assert.equal(operar(dados, 'iniciar', { dono: 'outro' }).recuperouOrfa.motivo, 'processo_dono_morto');
});

test('escrita com posse válida renova o sinal de vida da operação', t => {
  const dados = cenario(t);
  _dependencias.bootMs = () => Date.now() - 86_400_000;
  const { token } = operar(dados, 'iniciar', { dono: 'rodada-a' });
  const estado = estadoDe(dados); estado.ultimoProgresso = new Date(Date.now() - 3 * 3_600_000).toISOString(); gravarEstado(dados, estado);
  assert.equal(diagnosticarOperacaoOrfa(estadoDe(dados)).orfa, true);
  process.env.VAGAS_OPERACAO_TOKEN = JSON.stringify(token);
  t.after(() => { delete process.env.VAGAS_OPERACAO_TOKEN; });
  comEscritaCentral(dados, () => null);
  assert.equal(diagnosticarOperacaoOrfa(estadoDe(dados)).orfa, false);
});
