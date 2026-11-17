// Incidentes 6, 7, 9 e 10: lote parado, proveniência sem cache, captura esgotada e contatos de posts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { META_SEGUNDOS, ROTAS_CAPTURA, planejar, executar, consultar } from '../src/linkedin-feed-sessao.js';
import { aplicarProveniencia, conferirProvenienciaSalva, decidirLotePendente, loteAntigo, reaproveitarNaoConfirmadas } from '../src/linkedin-feed-integracao.js';
import { normalizarContato, ingerirDaSessao, registrarConexao, prepararMensagem, perguntaDeAutorizacao, registrarAutorizacao, registrarEnvio, proximasAcoes, exigirAcaoPermitida, listar } from '../src/contatos-posts.js';

const raizVagas = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = Date.parse('2026-11-09T12:00:00.000Z');
const tempo = s => new Date(base + s * 1000).toISOString();
function fixture(t) {
  const dirDados = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'autonomia-feed-')));
  t.after(() => fs.rmSync(dirDados, { recursive: true, force: true }));
  const comum = { dirDados, fuso: 'America/Sao_Paulo' };
  const fazer = (acao, s, extras = {}, dono = 'coletor-a') => executar({ ...comum, acao, dono, agora: tempo(s), ...extras });
  fazer.rota = () => planejar({ ...comum, agora: tempo(0) }).rotaAtual;
  return { comum, fazer, dirDados };
}
const iniciar = f => f('iniciar', 0, { aceiteRef: 'fixture:aceite', browserLiberadoRef: 'fixture:livre' });
const trecho = (f, ini, fim, rota = f.rota()) => f('intervalo', fim, { rota, inicioEm: tempo(ini), fimEm: tempo(fim), evidenciaInicio: `a${ini}`, evidenciaFim: `b${fim}`, provaRef: `p${fim}` });
const preencher = (f, rota, desde, segundos) => { for (let s = 0; s < segundos; s += 50) trecho(f, desde + s, desde + Math.min(s + 50, segundos), rota); };

test('buscas de Jobs acabam cedo: a rota esgotada libera a seguinte e a captura fecha como esgotada', t => {
  const { comum, fazer } = fixture(t);
  const s = iniciar(fazer);
  preencher(fazer, 'jobs', 0, 120);
  assert.throws(() => fazer('concluir', 200, { referencia: 'x' }), /TEMPO_INSUFICIENTE/);
  assert.throws(() => fazer('esgotar_rota', 200, { rota: 'postagens', buscas: 3, evidencia: 'x' }), /ROTA_FORA_DE_ORDEM/);
  assert.throws(() => fazer('esgotar_rota', 200, { rota: 'jobs', buscas: 0, evidencia: 'x' }), /CAMPO_INVALIDO:buscas/);
  assert.throws(() => fazer('esgotar_rota', 200, { rota: 'jobs', buscas: 3 }), /CAMPO_INVALIDO:evidencia/);
  fazer('esgotar_rota', 200, { rota: 'jobs', buscas: 8, evidencia: 'ledger: 8 buscas sem conteúdo novo' });
  assert.equal(fazer.rota(), 'postagens');
  preencher(fazer, 'postagens', 300, 100);
  fazer('esgotar_rota', 500, { rota: 'postagens', buscas: 5, evidencia: 'ledger: 5 buscas' });
  assert.equal(fazer.rota(), 'feed');
  assert.throws(() => fazer('concluir', 600, { referencia: 'x' }), /TEMPO_ROTA_INSUFICIENTE/);
  fazer('esgotar_rota', 600, { rota: 'feed', buscas: 2, evidencia: 'ledger: feed parado' });
  assert.equal(fazer.rota(), null);
  const fim = fazer('concluir', 700, { referencia: 'janela esgotada' });
  assert.equal(fim.estado, 'capturada');
  assert.deepEqual(fim.capturaEsgotada.rotas, ['jobs', 'postagens', 'feed']);
  assert.ok(fim.segundosAtivos < META_SEGUNDOS);
  assert.equal(planejar({ ...comum, agora: tempo(701) }).acao, 'integrar');
  assert.equal(consultar({ ...comum, runId: s.runId }).rotasEsgotadas.length, 3);
});

test('janela completa continua exigindo o tempo todo; esgotar não é atalho para quem tem meta a cumprir', t => {
  const { fazer } = fixture(t);
  iniciar(fazer);
  preencher(fazer, 'jobs', 0, 900);
  assert.throws(() => fazer('esgotar_rota', 1000, { rota: 'jobs', buscas: 1, evidencia: 'x' }), /ROTA_FORA_DE_ORDEM/);
  assert.throws(() => fazer('concluir', 1000, { referencia: 'x' }), /TEMPO_INSUFICIENTE/);
});

test('só o dono esgota rota', t => {
  const { fazer } = fixture(t);
  iniciar(fazer);
  assert.throws(() => fazer('esgotar_rota', 5, { rota: 'jobs', buscas: 1, evidencia: 'x' }, 'outro'), /POSSE_NEGADA/);
});

function capturada(f) {
  iniciar(f);
  f('esgotar_rota', 10, { rota: 'jobs', buscas: 1, evidencia: 'e' });
  f('esgotar_rota', 11, { rota: 'postagens', buscas: 1, evidencia: 'e' });
  f('esgotar_rota', 12, { rota: 'feed', buscas: 1, evidencia: 'e' });
  return f('concluir', 13, { referencia: 'c' });
}

test('lote capturado e abandonado passa a quem abre a rodada; antes de duas horas, não', t => {
  const { fazer } = fixture(t);
  capturada(fazer);
  assert.throws(() => fazer('assumir', 600, { referencia: 'r' }, 'rodada-nova'), /POSSE_NEGADA/);
  const s = fazer('assumir', 3 * 3600, { referencia: 'integrar-pendente' }, 'rodada-nova');
  assert.equal(s.dono, 'rodada-nova'); assert.equal(s.donoAnterior, 'coletor-a');
  assert.equal(fazer('assumir', 3 * 3600 + 1, { referencia: 'de novo' }, 'rodada-nova').dono, 'rodada-nova');
  assert.throws(() => fazer('assumir', 3 * 3600 + 2, { referencia: 'r' }, 'coletor-a'), /POSSE_NEGADA/);
});

test('captura em andamento não pode ser assumida', t => {
  const { fazer } = fixture(t);
  iniciar(fazer);
  assert.throws(() => fazer('assumir', 99999, { referencia: 'r' }, 'outro'), /ASSUMIR_INVALIDO/);
});

test('lote antigo fecha sem integrar e libera a janela do dia', t => {
  const { comum, fazer } = fixture(t);
  const s = capturada(fazer);
  assert.throws(() => fazer('encerrar_sem_integrar', 14, { relatorioRef: 'r.json', referencia: 'x' }), /CAMPO_INVALIDO:motivo/);
  assert.throws(() => fazer('encerrar_sem_integrar', 14, { motivo: 'm', referencia: 'x' }), /CAMPO_INVALIDO:relatorioRef/);
  assert.throws(() => fazer('encerrar_sem_integrar', 14, { motivo: 'm', relatorioRef: 'r', referencia: 'x', confirmadas: [{ idExterno: '' }] }), /INTEGRACAO_SEM_PROVA/);
  const r = fazer('encerrar_sem_integrar', 3 * 86400, { motivo: 'lote_antigo_sem_leitura_completa', relatorioRef: 'r.json', referencia: 'x' });
  assert.equal(r.estado, 'integrada'); assert.equal(r.integracao.pendentes, 0);
  assert.equal(consultar({ ...comum, runId: s.runId }).controle, undefined);
  assert.equal(planejar({ ...comum, agora: tempo(3 * 86400 + 5) }).acao, 'iniciar');
  assert.throws(() => fazer('encerrar_sem_integrar', 3 * 86400 + 6, { motivo: 'm', relatorioRef: 'r', referencia: 'x' }), /SESSAO_AUSENTE/);
});

test('decisão sobre o lote pendente', () => {
  const agora = new Date('2026-11-16T15:00:00Z'), fuso = 'America/Sao_Paulo';
  const sess = (extra = {}) => ({ runId: 'r', estado: 'capturada', dia: '2026-11-11', capturadaEm: '2026-11-11T15:00:00.000Z', iniciadaEm: '2026-11-11T14:00:00.000Z', observacoes: [{}, {}], ...extra });
  assert.deepEqual(decidirLotePendente(null, { agora, fuso }), { acao: 'nada' });
  assert.deepEqual(decidirLotePendente(sess({ estado: 'integrada' }), { agora, fuso }), { acao: 'nada' });
  assert.equal(decidirLotePendente(sess({ estado: 'parcial' }), { agora, fuso }).requerAceite, true);
  assert.equal(decidirLotePendente(sess({ estado: 'ativa' }), { agora, fuso }).acao, 'captura_parcial');
  assert.equal(decidirLotePendente(sess(), { agora, fuso }).acao, 'encerrar_antigo');
  assert.equal(decidirLotePendente(sess(), { agora, fuso, temRevisoes: true }).acao, 'integrar');
  const hoje = sess({ dia: '2026-11-16', capturadaEm: '2026-11-16T14:00:00.000Z' });
  assert.deepEqual(decidirLotePendente(hoje, { agora, fuso }), { acao: 'precisa_leitura', runId: 'r', observacoes: 2 });
  assert.equal(loteAntigo(hoje, { agora, fuso }), false);
  assert.equal(loteAntigo({ ...hoje, capturadaEm: '2026-11-15T10:00:00.000Z' }, { agora, fuso }), true);
});

test('proveniência: sem cópia no cache mas no quadro, segue; fora dos dois, falha; alias no quadro vale', () => {
  const cache = { vagas: { 'linkedin:1': { idExterno: 'linkedin:1', origemFeed: ['a'], idsAlternativos: [] } } };
  const estado = { vagas: { 'gupy:9': { status: 'Já apliquei' }, 'greenhouse:7': { status: 'Avaliar' } } };
  const r = aplicarProveniencia({ cache, estado, atualizacoes: [
    { idExterno: 'linkedin:1', origemFeed: ['b'], idsAlternativos: ['gupy:2'] },
    { idExterno: 'gupy:9', origemFeed: ['c'] },
    { idExterno: 'linkedin:99', origemFeed: ['d'], idsAlternativos: ['greenhouse:7'] },
    { idExterno: 'lever:5', origemFeed: ['e'] },
  ] });
  assert.equal(r.mudou, true);
  assert.deepEqual(r.semCache, ['gupy:9', 'linkedin:99']);
  assert.deepEqual(r.falhas.map(f => f.idExterno), ['lever:5']);
  assert.deepEqual(cache.vagas['linkedin:1'].origemFeed, ['a', 'b']);
  assert.deepEqual(cache.vagas['linkedin:1'].idsAlternativos, ['gupy:2']);
  assert.deepEqual(conferirProvenienciaSalva({ salvo: cache, atualizacoes: [{ idExterno: 'linkedin:1', origemFeed: ['b'] }] }), []);
  assert.equal(conferirProvenienciaSalva({ salvo: cache, atualizacoes: [{ idExterno: 'linkedin:1', origemFeed: ['zzz'] }] })[0].erro, 'PROVENIENCIA_NAO_CONFIRMADA');
});

// ---- contatos de posts ----

const contato = { nome: 'Marina Souza', perfil: 'https://www.linkedin.com/in/marina-souza-123?x=1', postLink: 'https://www.linkedin.com/feed/update/urn:li:activity:7001?trk=1', pedido: 'comentario' };

test('contato do post: endereços limpos, domínio e pedido validados', () => {
  assert.deepEqual(normalizarContato(contato), { nome: 'Marina Souza', perfil: 'https://www.linkedin.com/in/marina-souza-123', postLink: 'https://www.linkedin.com/feed/update/urn:li:activity:7001', pedido: 'comentario' });
  assert.equal(normalizarContato({ nome: 'Só Nome' }).pedido, 'nenhum');
  assert.throws(() => normalizarContato({ nome: 'X', perfil: 'https://evil.example/in/x' }), /CONTATO_PERFIL_INVALIDO/);
  assert.throws(() => normalizarContato({ nome: 'X', postLink: 'https://evil.example/feed/update/1' }), /CONTATO_POST_INVALIDO/);
  assert.throws(() => normalizarContato({ perfil: null }), /CONTATO_SEM_AUTOR/);
  assert.throws(() => normalizarContato({ nome: 'X', pedido: 'telefonar' }), /CONTATO_PEDIDO_INVALIDO/);
});

test('a observação guarda o contato e recusa contato inválido', t => {
  const { comum, fazer } = fixture(t);
  const s = iniciar(fazer);
  fazer('observar', 1, { observacao: { cargo: 'Product Designer', url: contato.postLink, referencia: 'r', contato } });
  assert.throws(() => fazer('observar', 2, { observacao: { cargo: 'X', url: 'https://x.test', referencia: 'r', contato: { nome: 'Y', perfil: 'https://evil.example/in/y' } } }), /CONTATO_PERFIL_INVALIDO/);
  assert.equal(consultar({ ...comum, runId: s.runId }).observacoes[0].contato.perfil, 'https://www.linkedin.com/in/marina-souza-123');
});

test('conectar é livre; a mensagem só sai depois do sim àquele texto; comentar é proibido', t => {
  const { comum, fazer, dirDados } = fixture(t);
  const arquivo = path.join(dirDados, 'contatos-posts.json');
  const s = iniciar(fazer);
  fazer('observar', 1, { observacao: { cargo: 'Product Designer', empresa: 'Acme', url: contato.postLink, referencia: 'r', contato } });
  fazer('observar', 2, { observacao: { cargo: 'UX Designer', url: 'https://x.test/p', referencia: 'r', contato: { nome: 'Sem Pedido', pedido: 'nenhum' } } });
  const sessao = consultar({ ...comum, runId: s.runId });
  assert.deepEqual(ingerirDaSessao(sessao, { arquivo }), { novos: 1, total: 1 });
  assert.deepEqual(ingerirDaSessao(sessao, { arquivo }), { novos: 0, total: 1 });
  let { livres, precisaDeVoce } = proximasAcoes({ arquivo });
  assert.deepEqual(livres.map(l => l.acao), ['conectar']); assert.equal(precisaDeVoce.length, 0);
  const id = livres[0].id;
  assert.throws(() => prepararMensagem(id, { texto: 'Oi', canal: 'linkedin', revisaoRef: 'r' }, { arquivo }), /ESTADO_INVALIDO/);
  registrarConexao(id, { provaRef: 'convite enviado sem nota' }, { arquivo });
  assert.deepEqual(proximasAcoes({ arquivo }).livres.map(l => l.acao), ['preparar_mensagem']);
  assert.throws(() => prepararMensagem(id, { texto: 'Oi', canal: 'whatsapp', revisaoRef: 'r' }, { arquivo }), /CANAL_INVALIDO/);
  assert.throws(() => prepararMensagem(id, { texto: 'Oi', canal: 'linkedin' }, { arquivo }), /REVISAO_OBRIGATORIA/);
  const lead = prepararMensagem(id, { texto: 'Olá, Marina. Vi a vaga de Product Designer e gostaria de conversar.', canal: 'linkedin', revisaoRef: 'review-escrita ok' }, { arquivo });
  ({ livres, precisaDeVoce } = proximasAcoes({ arquivo }));
  assert.equal(livres.length, 0); assert.equal(precisaDeVoce.length, 1);
  assert.match(precisaDeVoce[0].pergunta, /^Você autoriza o envio da mensagem para Marina Souza, referente à vaga Product Designer · Acme\?/);
  assert.match(precisaDeVoce[0].pergunta, /Texto: Olá, Marina/);
  assert.match(precisaDeVoce[0].resumo, /Autorizar uma mensagem para Marina Souza/);
  assert.throws(() => registrarEnvio(id, { provaRef: 'p' }, { arquivo }), /ENVIO_SEM_AUTORIZACAO/);
  assert.throws(() => registrarAutorizacao(id, { autorizacaoRef: 'sim', hashMostrado: 'outro-texto' }, { arquivo }), /AUTORIZACAO_DE_OUTRO_TEXTO/);
  registrarAutorizacao(id, { autorizacaoRef: 'a pessoa candidata: "sim" em 16 de Novembro', hashMostrado: lead.mensagem.hash }, { arquivo });
  assert.deepEqual(proximasAcoes({ arquivo }).livres.map(l => l.acao), ['enviar_mensagem']);
  // Texto alterado depois da autorização exige nova pergunta.
  prepararMensagem(id, { texto: 'Outro texto.', canal: 'linkedin', revisaoRef: 'r2' }, { arquivo });
  assert.equal(listar({ arquivo })[0].estado, 'aguardando_autorizacao');
  assert.throws(() => registrarEnvio(id, { provaRef: 'p' }, { arquivo }), /ENVIO_SEM_AUTORIZACAO/);
  for (const proibida of ['comentar', 'comment', 'Interested', 'responder publicamente']) assert.throws(() => exigirAcaoPermitida(proibida), /COMENTARIO_PROIBIDO/);
  assert.equal(exigirAcaoPermitida('conectar'), 'conectar');
});

test('o ciclo termina com o envio provado e sem pendência para a pessoa candidata', t => {
  const { comum, fazer, dirDados } = fixture(t);
  const arquivo = path.join(dirDados, 'contatos-posts.json');
  const s = iniciar(fazer);
  fazer('observar', 1, { observacao: { cargo: 'PD', url: contato.postLink, referencia: 'r', contato } });
  ingerirDaSessao(consultar({ ...comum, runId: s.runId }), { arquivo });
  const id = listar({ arquivo })[0].id;
  registrarConexao(id, { provaRef: 'ok' }, { arquivo });
  const { mensagem } = prepararMensagem(id, { texto: 'Olá', canal: 'email', revisaoRef: 'r' }, { arquivo });
  registrarAutorizacao(id, { autorizacaoRef: 'sim', hashMostrado: mensagem.hash }, { arquivo });
  registrarEnvio(id, { provaRef: 'e-mail enviado, visível em Enviados' }, { arquivo });
  assert.equal(listar({ arquivo })[0].estado, 'mensagem_enviada');
  assert.deepEqual(proximasAcoes({ arquivo }), { livres: [], precisaDeVoce: [] });
});

test('vaga que entrou no espelho e não foi confirmada volta como nova no mesmo lote, e só nele', () => {
  const anterior = { runId: 'r1', observacoesHash: 'h', novas: [{ idExterno: 'a:1', idObservacao: 'o1' }, { idExterno: 'a:2', idObservacao: 'o2' }] };
  const lote = { novas: [], duplicatas: [{ idObservacao: 'o1' }, { idObservacao: 'o2' }, { idObservacao: 'o3' }], contagem: { novas: 0, duplicatas: 3 } };
  const cache = { vagas: { 'a:2': { confirmacaoFila: { fonte: 'local' } } } };
  const r = reaproveitarNaoConfirmadas(lote, anterior, { cache, runId: 'r1', observacoesHash: 'h' });
  assert.deepEqual(r.novas.map(v => v.idExterno), ['a:1']);
  assert.deepEqual(r.duplicatas.map(d => d.idObservacao), ['o2', 'o3']);
  assert.deepEqual(r.contagem, { novas: 1, duplicatas: 2 });
  assert.equal(reaproveitarNaoConfirmadas(lote, anterior, { cache, runId: 'outro', observacoesHash: 'h' }), lote);
  assert.equal(reaproveitarNaoConfirmadas(lote, null, { cache, runId: 'r1', observacoesHash: 'h' }), lote);
});

test('comando de contatos: o ciclo inteiro pela linha de comando, sem comentar', t => {
  const { dirDados } = fixture(t);
  const arquivo = path.join(dirDados, 'contatos-posts.json');
  fs.writeFileSync(arquivo, JSON.stringify({ versao: 1, contatos: { c1: { id: 'c1', estado: 'a_conectar', contato: { nome: 'Marina', perfil: 'https://www.linkedin.com/in/marina', postLink: null, pedido: 'comentario' }, vaga: { cargo: 'PD', empresa: 'Acme', post: null }, historico: [] } } }));
  const cli = (...a) => spawnSync(process.execPath, [path.join(raizVagas, 'scripts/contatos-posts.mjs'), ...a], { cwd: raizVagas, encoding: 'utf8', env: { ...process.env, VAGAS_DIR_DADOS: dirDados, VAGAS_SEM_ENV: '1' } });
  const j = r => { assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
  assert.equal(j(cli('proximas')).livres[0].acao, 'conectar');
  j(cli('conectado', '--id', 'c1', '--prova', 'convite enviado'));
  const msg = path.join(dirDados, 'msg.json'); fs.writeFileSync(msg, JSON.stringify({ texto: 'Olá, Marina.', canal: 'linkedin', revisaoRef: 'ok' }));
  const p = j(cli('preparar', '--id', 'c1', '--arquivo', msg));
  assert.match(p.pergunta, /Você autoriza o envio da mensagem para Marina/);
  assert.match(cli('enviado', '--id', 'c1', '--prova', 'x').stderr, /ENVIO_SEM_AUTORIZACAO/);
  assert.match(cli('comentar', '--id', 'c1').stderr, /ACAO_DESCONHECIDA/);
  j(cli('autorizar', '--id', 'c1', '--ref', 'sim de a pessoa candidata', '--hash', p.hashMostrado));
  assert.equal(j(cli('enviado', '--id', 'c1', '--prova', 'mensagem visível na conversa')).estado, 'mensagem_enviada');
});
