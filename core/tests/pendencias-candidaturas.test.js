import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { registrarPendencias, lerPendencias, atualizarPendencia, bloqueiosPendencias, caminhosPendencias } from '../src/pendencias-candidaturas.js';
import { operarLote, planejarLote } from '../src/rodada-lote.js';

const base = path.dirname(fileURLToPath(import.meta.url));
function fixture(t) {
  const raiz = fs.mkdtempSync(path.join(base, 'pendencias-fixture-'));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  const dados = path.join(raiz, 'vagas/data');
  fs.mkdirSync(dados, { recursive: true });
  return dados;
}
const entrada = (id, idCanonico, tipo = 'video') => ({ id, idCanonico, empresa: 'Empresa Fictícia', cargo: 'Designer', tipo,
  etapa: 'formulario', urlCheckpoint: 'https://example.invalid/vaga', exigencia: 'Executar ação pessoal',
  proximaAcao: 'Concluir ação', fonte: 'fixture:formulario', data: '2026-11-16' });

for (const tipo of ['video', 'teste_comportamental']) test(`${tipo}: persiste, bloqueia apenas a vaga e libera com prova`, t => {
  const dados = fixture(t);
  const p = entrada(`P-${tipo}`, 'ats:bloqueada', tipo);
  registrarPendencias(dados, [p]);
  registrarPendencias(dados, [p]); // migração explícita repetida
  assert.equal(lerPendencias(dados).length, 1);
  const copia = JSON.parse(fs.readFileSync(caminhosPendencias(dados).json, 'utf8'));
  assert.equal(copia.pendencias.length, 1);
  const deps = { modoCandidatura: 'chrome_assistido', autorizadoCandidatura: true, consultarFila: () => ({ ids: ['ats:bloqueada', 'ats:livre'], provaRef: 'fixture:fila' }), gateEnvio: () => ({ aceito: true, provaRef: 'fixture:aceite' }) };
  const lote = operarLote(dados, 'iniciar', { frentes: ['aplicacao'], leituraRegrasRef: 'fixture:regras', filaInicial: deps.consultarFila() });
  // O gate do lote não libera Submit da vaga bloqueada, mesmo com revisão aprovada.
  const H = 'a'.repeat(64), J = 'b'.repeat(64);
  const fixada = operarLote(dados, 'fixar', { rodadaId: lote.rodadaId, id: 'ats:bloqueada', autor: 'fixture:autor', pacoteHash: H,
    fontes: [{ ref: 'fixture:fonte', hash: J }], observacaoAlvoRef: 'fixture:alvo' }, deps).vaga;
  operarLote(dados, 'revisar', { rodadaId: lote.rodadaId, id: 'ats:bloqueada', pacoteHash: fixada.pacote.hash,
    revisor: 'fixture:revisor', observacaoAlvoRef: 'fixture:alvo', aprovada: true, provaRef: 'fixture:revisao' }, deps);
  assert.throws(() => operarLote(dados, 'liberar_envio', { rodadaId: lote.rodadaId, id: 'ats:bloqueada',
    pacoteHash: fixada.pacote.hash }, deps), /ACAO_PESSOAL_PENDENTE/);
  let plano = planejarLote(dados, deps);
  assert.deepEqual(plano.ordemAplicacao.map(v => v.id), ['ats:livre']);
  assert.equal(plano.pendenciasPessoais.length, 1);
  assert.equal(plano.podeAplicar, true);
  assert.throws(() => atualizarPendencia(dados, p.id, 'resolvida'), /PROVA_RESOLUCAO/);
  assert.throws(() => atualizarPendencia(dados, p.id, 'resolvida', 'ats:outra|formulario|fixture:errada'), /PROVA_VAGA_ETAPA/);
  atualizarPendencia(dados, p.id, 'realizada_aguardando_conferencia');
  assert.equal(bloqueiosPendencias(dados, p.idCanonico).length, 1);
  assert.deepEqual(planejarLote(dados, deps).ordemAplicacao.map(v => v.id), ['ats:livre']);
  // Uma fotografia posterior sem a vaga não apaga o registro.
  deps.consultarFila = () => ({ ids: ['ats:livre'], provaRef: 'fixture:fila-posterior' });
  assert.equal(lerPendencias(dados).length, 1);
  assert.equal(planejarLote(dados, deps).pendenciasPessoais.length, 1);
  atualizarPendencia(dados, p.id, 'resolvida', 'ats:bloqueada|formulario|fixture:mesma-vaga-etapa-conferida');
  assert.equal(bloqueiosPendencias(dados, p.idCanonico).length, 0);
  deps.consultarFila = () => ({ ids: ['ats:bloqueada', 'ats:livre'], provaRef: 'fixture:retorno' });
  plano = planejarLote(dados, deps);
  assert.deepEqual(plano.ordemAplicacao.map(v => v.id), ['ats:bloqueada', 'ats:livre']);
  assert.equal(lote.rodadaId, plano.rodadaId);
  operarLote(dados, 'atualizar', { rodadaId: lote.rodadaId, id: 'ats:bloqueada', estado: 'aguardando_pessoa', provaRef: 'fixture:aguardando' }, deps);
  const retomada = operarLote(dados, 'atualizar', { rodadaId: lote.rodadaId, id: 'ats:bloqueada', estado: 'preparando', provaRef: 'fixture:mesma-etapa-retomada' }, deps);
  assert.equal(retomada.vaga.estado, 'preparando');
});

test('fence corrompido falha fechado no planejador', t => {
  const dados = fixture(t);
  const caminho = caminhosPendencias(dados).markdown;
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, '# Pendências pessoais de candidaturas\n\n```json pendencia\n{\"id\":\"P-1\"}');
  assert.throws(() => lerPendencias(dados), /PENDENCIAS_MARKDOWN_INVALIDO/);
});

test('segundo fence com rótulo corrompido não desaparece da fila', t => {
  const dados = fixture(t);
  registrarPendencias(dados, [entrada('P-1', 'ats:primeira')]);
  const caminho = caminhosPendencias(dados).markdown;
  fs.appendFileSync(caminho, '\n## P-2 · Empresa Fictícia\n\n```json pendenciA\n{\"id\":\"P-2\"}\n```\n');
  assert.throws(() => lerPendencias(dados), /PENDENCIAS_MARKDOWN_INVALIDO/);
  assert.throws(() => bloqueiosPendencias(dados, 'ats:segunda'), /PENDENCIAS_MARKDOWN_INVALIDO/);
});

test('registro novo nasce pendente; estado terminal só pelo fluxo de resolução', t => {
  const dados = fixture(t);
  const p = entrada('P-3', 'ats:terceira');
  assert.throws(() => registrarPendencias(dados, [{ ...p, estado: 'resolvida', provaResolucao: 'ats:terceira|formulario|fixture:prova' }]), /PENDENCIA_NOVA_DEVE_SER_PENDENTE/);
  assert.equal(lerPendencias(dados).length, 0);
  registrarPendencias(dados, [p]);
  atualizarPendencia(dados, p.id, 'resolvida', 'ats:terceira|formulario|fixture:prova');
  registrarPendencias(dados, [lerPendencias(dados)[0]]); // replay idêntico
  assert.equal(lerPendencias(dados).length, 1);
});


function escritor(dados, acao, registro) {
  const modulo = new URL('../src/pendencias-candidaturas.js', import.meta.url).href;
  const codigo = `import fs from 'node:fs';
    const [modulo, dados, acao, bruto] = process.argv.slice(1);
    const api = await import(modulo);
    const original = fs.writeFileSync;
    // Amplia a janela após a leitura e antes da publicação; dois processos reais.
    fs.writeFileSync = function(caminho, ...args) {
      if (String(caminho).endsWith('.tmp')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 80);
      return original.call(this, caminho, ...args);
    };
    const registro = JSON.parse(bruto);
    if (acao === 'registrar') api.registrarPendencias(dados, [registro]);
    else if (acao === 'atualizar') api.atualizarPendencia(dados, registro.id, 'resolvida', registro.prova);
    else api.projetarPendencias(dados);`;
  return new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, ['--input-type=module', '-e', codigo, modulo, dados, acao, JSON.stringify(registro)]);
    let erro = '';
    filho.stderr.on('data', parte => { erro += parte; });
    filho.on('error', reject);
    filho.on('close', codigo => codigo === 0 ? resolve() : reject(new Error(erro || `processo terminou com ${codigo}`)));
  });
}

test('dois processos preservam registros e resoluções concorrentes', async t => {
  const dados = fixture(t);
  const a = entrada('P-CONCORRENTE-A', 'ats:concorrente-a');
  const b = entrada('P-CONCORRENTE-B', 'ats:concorrente-b');
  await Promise.all([escritor(dados, 'registrar', a), escritor(dados, 'registrar', b)]);
  assert.deepEqual(lerPendencias(dados).map(p => p.id).sort(), [a.id, b.id].sort());
  await Promise.all([... [a, b].map(p => escritor(dados, 'atualizar', { id: p.id, prova: `${p.idCanonico}|${p.etapa}|fixture:conferida` })), escritor(dados, 'projetar', {})]);
  assert.equal(lerPendencias(dados).filter(p => p.estado === 'resolvida').length, 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(caminhosPendencias(dados).json)).pendencias, lerPendencias(dados));
});


test('escritor aguarda lock ocupado e não remove posse de outro processo', async t => {
  const dados = fixture(t);
  registrarPendencias(dados, [entrada('P-BASE', 'ats:base')]);
  const { markdown } = caminhosPendencias(dados);
  const lock = path.join(path.dirname(markdown), '.PENDENCIAS-CANDIDATURAS.md.lock');
  fs.writeFileSync(lock, 'fixture:outro-escritor');
  const tentativa = escritor(dados, 'registrar', entrada('P-DEPOIS', 'ats:depois'));
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(lerPendencias(dados).length, 1);
  assert.equal(fs.readFileSync(lock, 'utf8'), 'fixture:outro-escritor');
  fs.unlinkSync(lock);
  await tentativa;
  assert.equal(lerPendencias(dados).length, 2);
  assert.equal(fs.existsSync(lock), false);
});

test('lock persistente falha fechado com limite e preserva arquivos e trava', async t => {
  const dados = fixture(t);
  registrarPendencias(dados, [entrada('P-BASE', 'ats:base')]);
  const { markdown, json } = caminhosPendencias(dados);
  const lock = path.join(path.dirname(markdown), '.PENDENCIAS-CANDIDATURAS.md.lock');
  const antes = [fs.readFileSync(markdown, 'utf8'), fs.readFileSync(json, 'utf8')];
  fs.writeFileSync(lock, 'fixture:posse-preservada');
  await assert.rejects(escritor(dados, 'registrar', entrada('P-RECUSADA', 'ats:recusada')), /PENDENCIAS_LOCK_OCUPADO/);
  assert.deepEqual([fs.readFileSync(markdown, 'utf8'), fs.readFileSync(json, 'utf8')], antes);
  assert.equal(fs.readFileSync(lock, 'utf8'), 'fixture:posse-preservada');
});

test('symlinks em fonte, projeção ou lock são recusados sem tocar o destino', t => {
  const dados = fixture(t);
  registrarPendencias(dados, [entrada('P-BASE', 'ats:base')]);
  const { markdown, json } = caminhosPendencias(dados);
  const lock = path.join(path.dirname(markdown), '.PENDENCIAS-CANDIDATURAS.md.lock');
  const alvo = path.join(path.dirname(markdown), 'alvo.txt');
  fs.writeFileSync(alvo, 'fixture:inalterada');
  for (const destino of [lock, markdown, json]) {
    const antes = fs.existsSync(destino) ? fs.readFileSync(destino) : null;
    if (antes) fs.unlinkSync(destino);
    fs.symlinkSync(alvo, destino);
    if (destino === markdown) assert.throws(() => lerPendencias(dados), /PENDENCIAS_CAMINHO_INSEGURO/);
    assert.throws(() => registrarPendencias(dados, [entrada('P-BASE', 'ats:base')]), /PENDENCIAS_CAMINHO_INSEGURO/);
    assert.equal(fs.readFileSync(alvo, 'utf8'), 'fixture:inalterada');
    fs.unlinkSync(destino);
    if (antes) fs.writeFileSync(destino, antes);
  }
});
