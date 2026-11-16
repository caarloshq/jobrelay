import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mensagemVersao, compararVersoes, lerVersaoInstalada, consultarUltimaRelease } from '../src/versao-produto.js';
import { main } from '../scripts/verificar-versao.mjs';

const t = (e) => mensagemVersao(e);

test('cada situação gera o texto exato da spec 015', () => {
  assert.deepEqual(t({ instalada: '1.5.1', destino: '1.5.3' }), { estado: 'atualizar', texto: 'Você está na versão 1.5.1. A atualização leva para a versão 1.5.3.' });
  assert.equal(t({ instalada: '1.5.1', destino: '1.5.3', adaptado: true }).texto, 'Seu núcleo está adaptado da versão 1.5.1. A atualização leva para a versão 1.5.3, mantendo o que é só da sua instalação.');
  assert.equal(t({ instalada: '1.5.3', destino: '1.5.3', evidencia: 'sem_atualizacao' }).texto, 'Você já está na versão 1.5.3, a mais recente. Nada para atualizar.');
  assert.equal(t({ instalada: '1.5.3', destino: '1.5.3', adaptado: true }).texto, 'Seu núcleo está adaptado da versão 1.5.3, a mais recente. O que é só da sua instalação foi preservado.');
  assert.equal(t({ instalada: '1.6.0', destino: '1.5.3' }).texto, 'Você está na versão 1.6.0, mais nova que a última versão publicada (1.5.3). Nada para atualizar.');
  assert.equal(t({ instalada: '1.5.1', destino: null }).texto, 'Você está na versão 1.5.1, mas não consegui consultar a última versão agora. Isso não quer dizer que esteja em dia.');
  assert.equal(t({ instalada: null, destino: '1.5.3' }).texto, 'Não consegui identificar a versão instalada. A última versão publicada é a 1.5.3.');
  assert.equal(t({}).texto, 'Não consegui identificar a versão instalada nem consultar a última publicada. Nada foi alterado.');
  assert.equal(t({ instalada: '1.5.1', destino: '1.5.3', depois: true }).texto, 'Atualizado: da versão 1.5.1 para a versão 1.5.3.');
  assert.equal(t({ instalada: '1.5.1', destino: '1.5.3', depois: true, adaptado: true }).texto, 'Núcleo adaptado da versão 1.5.1 para a versão 1.5.3. O que é só da sua instalação foi preservado.');
});

test('mesmo número sem prova do atualizador não diz que está em dia', () => {
  const m = t({ instalada: '1.5.3', destino: '1.5.3' });
  assert.equal(m.estado, 'mesmo_numero');
  assert.doesNotMatch(m.texto, /Nada para atualizar|em dia/);
  assert.match(m.texto, /não prova que os arquivos são os mesmos/);
});

test('bloqueio, checagem desligada e versão do núcleo ainda não registrada', () => {
  assert.equal(t({ instalada: '1.5.1', destino: '1.5.3', evidencia: 'bloqueado', motivo: 'CODIGO_LOCAL_MODIFICADO\n  mais' }).texto,
    'Você está na versão 1.5.1. A atualização para a 1.5.3 está bloqueada: CODIGO_LOCAL_MODIFICADO mais. Nada foi alterado.');
  assert.match(t({ instalada: '1.5.1', destino: '1.5.3', evidencia: 'bloqueado' }).texto, /motivo não informado/);
  assert.match(t({ instalada: '1.5.1', destino: '1.5.3', evidencia: 'desativada' }).texto, /desligada nas preferências/);
  assert.equal(t({ instalada: '1.5.1', destino: null, evidencia: 'desativada' }).estado, 'desativada');
  assert.match(t({ instalada: '1.5.1', destino: '1.5.3', evidencia: 'bloqueado', motivo: 'Falha.' }).texto, /bloqueada: Falha\. Nada/);
  assert.equal(t({ instalada: '1.0.0', destino: '1.5.3', adaptado: true, registrada: false }).estado, 'nao_registrada');
  assert.match(t({ instalada: '1.0.0', destino: '1.5.3', adaptado: true, registrada: false }).texto, /ainda não foi registrada/);
});

test('versão ilegível e sufixo de pré-lançamento', () => {
  for (const ruim of ['1.5', 'v1.5.3', '', 'x', 7, {}]) assert.equal(t({ instalada: ruim, destino: '1.5.3' }).estado, 'sem_versao_instalada');
  assert.equal(t({ instalada: '1.5.3', destino: '1.5.3-rc.1' }).estado, 'sem_consulta');
  assert.equal(t({ instalada: '1.6.0-rc.1', destino: '1.6.0' }).estado, 'atualizar');
  assert.equal(compararVersoes('1.10.0', '1.9.9'), 1);
  assert.equal(compararVersoes('1.5.3', '1.5.3'), 0);
});

test('nenhum texto tem travessão', () => {
  for (const e of [{ instalada: '1.5.1', destino: '1.5.3' }, { instalada: '1.5.3', destino: '1.5.3', evidencia: 'sem_atualizacao' }, {}, { instalada: '1.5.1' }]) assert.doesNotMatch(t(e).texto, /[—–]/);
});

function pasta(t, pacote, registro) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versao-produto-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (pacote) fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pacote));
  if (registro) { fs.mkdirSync(path.join(dir, 'config')); fs.writeFileSync(path.join(dir, 'config', 'nucleo-publico.json'), JSON.stringify(registro)); }
  return dir;
}

test('lê a versão do pacote e o registro do núcleo adaptado', t => {
  assert.deepEqual(lerVersaoInstalada(pasta(t, { version: '1.5.3' })), { versao: '1.5.3', adaptado: false, registrada: true });
  assert.deepEqual(lerVersaoInstalada(pasta(t, { version: '1.5.0' }, { registrada: true, commit: 'abc' })), { versao: '1.5.0', adaptado: true, registrada: true });
  assert.equal(lerVersaoInstalada(pasta(t, { version: '1.0.0' }, { registrada: false })).registrada, false);
  assert.equal(lerVersaoInstalada(pasta(t, null)).versao, null);
});

const resposta = (corpo, ok = true) => async () => ({ ok, json: async () => corpo });

test('consulta aceita só release estável e nunca lança', async () => {
  assert.deepEqual(await consultarUltimaRelease({ fetch: resposta({ tag_name: 'v1.5.3', draft: false, prerelease: false }) }), { ok: true, versao: '1.5.3' });
  for (const ruim of [{ tag_name: 'v1.5.3', draft: true, prerelease: false }, { tag_name: 'v1.6.0', draft: false, prerelease: true }, { tag_name: 'main', draft: false, prerelease: false }, null]) {
    assert.deepEqual(await consultarUltimaRelease({ fetch: resposta(ruim) }), { ok: false });
  }
  assert.deepEqual(await consultarUltimaRelease({ fetch: resposta({}, false) }), { ok: false });
  assert.deepEqual(await consultarUltimaRelease({ fetch: async () => { throw new Error('https://segredo.exemplo/token=abc'); } }), { ok: false });
  const lenta = (_u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('abortado'))));
  assert.deepEqual(await consultarUltimaRelease({ fetch: lenta, timeoutMs: 20 }), { ok: false });
});

test('verificar:versao imprime a mensagem sem rede, sem eco de erro, e o Git depois', async t => {
  const dir = pasta(t, { version: '1.5.1' });
  const linhas = [];
  const git = async () => ({ status: 'current', mensagem: 'M', orientacao: 'O' });
  const msg = await main({ cwd: dir, fetch: resposta({ tag_name: 'v1.5.3', draft: false, prerelease: false }), saida: l => linhas.push(l), verificarGit: git });
  assert.equal(msg.estado, 'atualizar');
  assert.deepEqual(linhas, ['Você está na versão 1.5.1. A atualização leva para a versão 1.5.3.', 'Quer atualizar agora? Nada é instalado sem o seu sim.', '[Git: current] M\nO']);
  const falha = [];
  await main({ cwd: dir, fetch: async () => { throw new Error('https://segredo.exemplo/token=abc'); }, saida: l => falha.push(l), verificarGit: git });
  assert.match(falha[0], /não consegui consultar a última versão agora/);
  assert.doesNotMatch(falha.join('\n'), /segredo|token/);
});

test('instalação adaptada: o registro do núcleo concorda com o número do pacote', () => {
  const vagas = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const arquivo = path.join(vagas, 'config', 'nucleo-publico.json');
  if (!fs.existsSync(arquivo)) return; // cópia fiel (público) não tem registro
  const registro = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const { version } = JSON.parse(fs.readFileSync(path.join(vagas, 'package.json'), 'utf8'));
  assert.equal(registro.registrada, true);
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal('tag' in registro, false); // o número vive só no package.json
  assert.match(registro.commit, /^[0-9a-f]{40}$/);
  assert.doesNotMatch(JSON.stringify(registro), /[—–]/);
});
