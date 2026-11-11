import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { META_SEGUNDOS, ROTAS_CAPTURA, planejar, executar, consultar } from '../src/linkedin-feed-sessao.js';
import { operar } from '../src/operacao.js';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const base = Date.parse('2026-11-09T12:00:00.000Z');
const tempo = segundos => new Date(base + segundos * 1000).toISOString();
function fixture(t) {
  const dirDados = fs.mkdtempSync(path.join(dataDir, 'linkedin-feed-test-'));
  t.after(() => fs.rmSync(dirDados, { recursive: true, force: true }));
  const comum = { dirDados, fuso: 'America/Sao_Paulo' };
  const fazer = (acao, segundos, extras = {}, dono = 'coletor-a') => executar({ ...comum, acao, dono, agora: tempo(segundos), ...extras });
  fazer.rota = () => planejar({ ...comum, agora: tempo(0) }).rotaAtual;
  return { comum, fazer, dirDados };
}
function iniciar(fazer) { return fazer('iniciar', 0, { browserLiberadoRef: 'checkpoint-browser-liberado' }); }
function intervalo(fazer, inicio, fim, dono, rota = fazer.rota()) {
  return fazer('intervalo', fim, { rota, inicioEm: tempo(inicio), fimEm: tempo(fim), evidenciaInicio: `feed-${inicio}`, evidenciaFim: `feed-${fim}`, provaRef: `snapshot-${fim}` }, dono);
}

test('primeira coleta reserva o dia; aplicação isolada e opt-out não criam sessão', t => {
  const { comum, fazer, dirDados } = fixture(t);
  assert.deepEqual(planejar({ ...comum, frente: 'aplicacao', agora: tempo(0) }), { acao: 'desabilitada' });
  assert.deepEqual(planejar({ ...comum, habilitado: false, agora: tempo(0) }), { acao: 'desabilitada' });
  assert.equal(fs.existsSync(path.join(dirDados, 'linkedin-feed')), false);
  assert.throws(() => fazer('iniciar', 0), /CAMPO_INVALIDO:browserLiberadoRef/);
  const s = iniciar(fazer);
  assert.equal(planejar({ ...comum, agora: tempo(1) }).acao, 'retomar');
  assert.throws(() => fazer('iniciar', 1, { browserLiberadoRef: 'outro' }, 'coletor-b'), /JANELA_JA_RESERVADA/);
  assert.throws(() => fazer('observar', 2, { observacao: { url: 'https://example.com' } }, 'coletor-b'), /POSSE_NEGADA/);
  assert.throws(() => executar({ ...comum, frente: 'aplicacao', acao: 'iniciar', dono: 'coletor-b', agora: tempo(3) }), /FRENTE_INVALIDA/);
  assert.equal(consultar({ ...comum, runId: s.runId }).dono, 'coletor-a');
});

test('observações são duráveis, com campos desconhecidos nulos, e separadas por função', t => {
  const { comum, fazer } = fixture(t);
  const s = iniciar(fazer);
  fazer('observar', 3, { observacao: { cargo: 'Designer', url: 'https://example.com/post/1', origem: 'feed', referencia: 'captura-a' } });
  fazer('observar', 4, { observacao: { cargo: 'Product Designer', empresa: 'Empresa B', url: 'https://example.com/post/1', linkCandidatura: 'https://example.com/apply/2', origem: 'feed', referencia: 'captura-b' } });
  const salvo = consultar({ ...comum, runId: s.runId });
  assert.equal(salvo.observacoes.length, 2);
  assert.equal(salvo.observacoes[0].empresa, null);
  assert.equal(salvo.observacoes[0].linkCandidatura, null);
  assert.equal(salvo.observacoes[1].cargo, 'Product Designer');
  assert.throws(() => fazer('observar', 5, { observacao: { cargo: 'Sem referência' } }), /REFERENCIA_OBRIGATORIA/);
  assert.equal(consultar({ ...comum, runId: s.runId }).observacoes.length, 2);
});

test('checkpoints curtos contam atividade; pausa, espera e interrupção não contam', t => {
  assert.equal(META_SEGUNDOS, 1800);
  const { comum, fazer } = fixture(t);
  const s = iniciar(fazer);
  assert.throws(() => intervalo(fazer, 0, 61), /CHECKPOINT_LONGO/);
  assert.throws(() => fazer('concluir', 100, { referencia: 'fim' }), /TEMPO_INSUFICIENTE/);
  intervalo(fazer, 0, 60);
  fazer('pausar', 90, { referencia: 'interrupcao' });
  assert.throws(() => intervalo(fazer, 90, 120), /CAPTURA_INATIVA/);
  assert.throws(() => fazer('retomar', 200, {}, 'coletor-b'), /POSSE_NEGADA/);
  assert.throws(() => fazer('retomar', 200), /CAMPO_INVALIDO:browserLiberadoRef/);
  fazer('retomar', 200, { browserLiberadoRef: 'browser-reconferido' });
  assert.throws(() => intervalo(fazer, 100, 160), /INTERVALO_INVALIDO/);
  for (let i = 0; i < 29; i++) intervalo(fazer, 200 + i * 60, 260 + i * 60);
  assert.equal(consultar({ ...comum, runId: s.runId }).segundosAtivos, 1800);
  const capturada = fazer('concluir', 2000, { referencia: 'relatorio-captura' });
  assert.equal(capturada.estado, 'capturada');
  assert.equal(planejar({ ...comum, agora: tempo(2001) }).acao, 'integrar');
  assert.throws(() => fazer('intervalo', 2002, { inicioEm: tempo(2001), fimEm: tempo(2002), evidenciaInicio: 'a', evidenciaFim: 'b', provaRef: 'c' }), /CAPTURA_INATIVA/);
  fazer('liberar', 2002, { referencia: 'handoff-integracao' });
  assert.equal(consultar({ ...comum, runId: s.runId }).estado, 'capturada');
  assert.throws(() => fazer('integrado', 2003, { referencia: 'relatorio' }, 'integrador-b'), /POSSE_NEGADA/);
  fazer('retomar', 2003, { handoffRef: 'handoff-integracao' }, 'integrador-b');
  assert.throws(() => fazer('integrado', 2003, { referencia: 'relatorio' }, 'integrador-b'), /INTEGRACAO_SEM_PROVA/);
  fazer('integrado', 2003, { referencia: 'relatorio-integracao-confirmada', integracao: { pendentes: 0, confirmadas: [], relatorioRef: 'lote-sem-vagas' } }, 'integrador-b');
  assert.equal(planejar({ ...comum, agora: tempo(2004) }).acao, 'dispensar');
  assert.equal(planejar({ ...comum, agora: tempo(86400) }).acao, 'iniciar');
});

test('guarda central recusa mutação sem posse quando operação principal está ativa', t => {
  const { comum, dirDados } = fixture(t);
  const { token } = operar(dirDados, 'iniciar', { dono: 'outro-controlador' });
  assert.throws(() => executar({ ...comum, acao: 'iniciar', dono: 'coletor-a', agora: tempo(0), browserLiberadoRef: 'livre' }), /POSSE_NEGADA/);
  assert.throws(() => executar({ ...comum, acao: 'iniciar', dono: 'coletor-a', agora: tempo(0), browserLiberadoRef: 'livre', token }), /TOKEN_EXPLICITO_NAO_ACEITO/);
  assert.equal(planejar({ ...comum, agora: tempo(0) }).acao, 'iniciar');
  operar(dirDados, 'encerrar', { token });
});

test('controle é fonte única quando projeção da sessão falta ou está desatualizada', t => {
  const { comum, fazer, dirDados } = fixture(t);
  const s = iniciar(fazer);
  const arquivo = path.join(dirDados, 'linkedin-feed', s.runId, 'sessao.json');
  fs.unlinkSync(arquivo); // simula queda após gravação atômica do controle
  assert.equal(planejar({ ...comum, agora: tempo(1) }).acao, 'retomar');
  fazer('observar', 2, { observacao: { cargo: 'Designer', url: 'https://example.com/vaga', origem: 'feed' } });
  fs.writeFileSync(arquivo, JSON.stringify(s)); // projeção antiga não substitui a fonte
  assert.equal(consultar({ ...comum, runId: s.runId }).observacoes.length, 1);
  intervalo(fazer, 0, 60);
  assert.equal(consultar({ ...comum, runId: s.runId }).segundosAtivos, 60);
  assert.equal(consultar({ ...comum, runId: s.runId }).observacoes.length, 1);
});

test('liberação explícita permite outro dono retomar mesmo lote; virada de dia não cria dois blocos', t => {
  const { comum, fazer } = fixture(t);
  const antigo = iniciar(fazer);
  intervalo(fazer, 0, 60);
  fazer('liberar', 61, { referencia: 'browser-liberado' });
  const amanha = tempo(86400);
  assert.equal(planejar({ ...comum, agora: amanha }).runId, antigo.runId);
  assert.equal(planejar({ ...comum, agora: amanha }).acao, 'retomar');
  assert.throws(() => executar({ ...comum, acao: 'iniciar', dono: 'coletor-b', agora: amanha, browserLiberadoRef: 'livre' }), /JANELA_JA_RESERVADA/);
  assert.throws(() => executar({ ...comum, acao: 'retomar', dono: 'coletor-b', agora: amanha, browserLiberadoRef: 'livre' }), /CAMPO_INVALIDO:handoffRef/);
  assert.throws(() => executar({ ...comum, acao: 'retomar', dono: 'coletor-b', agora: amanha, handoffRef: 'handoff' }), /CAMPO_INVALIDO:browserLiberadoRef/);
  const retomada = executar({ ...comum, acao: 'retomar', dono: 'coletor-b', agora: amanha, browserLiberadoRef: 'browser-novo', handoffRef: 'handoff-confirmado' });
  assert.equal(retomada.runId, antigo.runId);
  assert.equal(retomada.dia, '2026-11-09');
  assert.equal(retomada.segundosAtivos, 60);
  for (let i = 0; i < 29; i++) intervalo(fazer, 86400 + i * 60, 86460 + i * 60, 'coletor-b');
  fazer('concluir', 88200, { referencia: 'captura' }, 'coletor-b');
  fazer('integrado', 88201, { referencia: 'integracao', integracao: { pendentes: 0, confirmadas: [], relatorioRef: 'sem-vagas' } }, 'coletor-b');
  assert.equal(planejar({ ...comum, agora: tempo(88202) }).acao, 'dispensar');
  assert.equal(planejar({ ...comum, agora: tempo(172800) }).acao, 'iniciar');
});

test('dia é calculado no fuso configurado; caminhos de lote não aceitam traversal ou symlink', t => {
  const { comum, fazer, dirDados } = fixture(t);
  const s = iniciar(fazer);
  assert.equal(s.dia, '2026-11-09');
  const meiaNoiteUtc = '2026-11-10T01:00:00.000Z';
  assert.equal(planejar({ ...comum, agora: meiaNoiteUtc }).runId, s.runId);
  assert.throws(() => consultar({ ...comum, runId: '../outro' }), /RUN_INVALIDO/);
  const link = path.join(dirDados, 'dados-link');
  fs.symlinkSync(dirDados, link);
  assert.throws(() => planejar({ ...comum, dirDados: link, agora: tempo(0) }), /DADOS_INSEGUROS/);
});

test('novos lotes exigem Jobs 900s, Postagens 720s e Feed 180s na ordem aprovada', t => {
  const { comum, fazer } = fixture(t);
  const plano = planejar({ ...comum, agora: tempo(0) });
  assert.equal(plano.rotaAtual, 'jobs');
  assert.deepEqual(plano.rotas.map(r => r.restantes), [900, 720, 180]);
  const s = iniciar(fazer);
  assert.deepEqual(s.rotasCaptura, ROTAS_CAPTURA);
  assert.throws(() => intervalo(fazer, 0, 60, undefined, null), /ROTA_OBRIGATORIA/);
  assert.throws(() => intervalo(fazer, 0, 60, undefined, 'feed'), /ROTA_FORA_DE_ORDEM/);
  for (let i = 0; i < 15; i++) intervalo(fazer, i * 60, (i + 1) * 60);
  assert.equal(planejar({ ...comum, agora: tempo(900) }).rotaAtual, 'postagens');
  assert.throws(() => intervalo(fazer, 900, 960, undefined, 'jobs'), /ROTA_FORA_DE_ORDEM/);
  for (let i = 15; i < 27; i++) intervalo(fazer, i * 60, (i + 1) * 60);
  assert.equal(planejar({ ...comum, agora: tempo(1620) }).rotaAtual, 'feed');
  intervalo(fazer, 1620, 1680);
  intervalo(fazer, 1680, 1740);
  intervalo(fazer, 1740, 1790);
  assert.throws(() => intervalo(fazer, 1790, 1801), /TEMPO_ROTA_EXCEDIDO/);
  assert.throws(() => fazer('concluir', 1801, { referencia: 'cedo' }), /TEMPO_INSUFICIENTE/);
  intervalo(fazer, 1790, 1800);
  assert.equal(fazer('concluir', 1801, { referencia: 'fixture:distribuicao-completa' }).estado, 'capturada');
  assert.equal(planejar({ ...comum, agora: tempo(1802) }).rotaAtual, null);
});

test('lote legado sem rotas retoma janela original sem reinterpretar seus intervalos', t => {
  const { comum, fazer, dirDados } = fixture(t);
  const s = iniciar(fazer);
  const controlePath = path.join(dirDados, 'linkedin-feed', 'controle.json');
  const controle = JSON.parse(fs.readFileSync(controlePath, 'utf8'));
  delete controle.sessoes[s.runId].rotasCaptura; // fixture de formato anterior, sem modificar dados reais
  fs.writeFileSync(controlePath, JSON.stringify(controle));
  const plano = planejar({ ...comum, agora: tempo(0) });
  assert.equal(plano.legado, true);
  assert.equal(plano.rotaAtual, null);
  for (let i = 0; i < 30; i++) intervalo(fazer, i * 60, (i + 1) * 60);
  const capturada = fazer('concluir', 1801, { referencia: 'fixture:contrato-anterior' });
  assert.equal(capturada.estado, 'capturada');
  assert.equal(Object.hasOwn(capturada, 'rotasCaptura'), false);
  assert.equal(capturada.intervalos.some(i => Object.hasOwn(i, 'rota')), false);
});

test('checkpoints fracionários preservam contagem por rota sem divergência decimal', t => {
  const { comum, fazer } = fixture(t);
  iniciar(fazer);
  intervalo(fazer, 0, 0.1);
  intervalo(fazer, 0.1, 0.3);
  const plano = planejar({ ...comum, agora: tempo(1) });
  assert.equal(plano.segundosAtivos, 0.3);
  assert.equal(plano.rotas[0].segundosAtivos, 0.3);
  assert.equal(plano.rotas[0].restantes, 899.7);
});
