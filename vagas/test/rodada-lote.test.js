import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { operarLote, planejarLote, resumoColeta, resumoAplicacao, linhaProgressoAplicacao, politicaMelhorias } from '../src/rodada-lote.js';
import { operar } from '../src/operacao.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = 'a'.repeat(64), J = 'b'.repeat(64);
function fixture(t, ids = ['ats:1', 'ats:2', 'ats:3', 'ats:4', 'ats:5'], frentes = ['coleta', 'aplicacao']) {
  const dados = fs.mkdtempSync(path.join(raiz, 'data', 'rodada-lote-test-'));
  t.after(() => fs.rmSync(dados, { force: true, recursive: true }));
  let atual = [...ids];
  const deps = { consultarFila: () => ({ ids: atual, provaRef: 'fixture:consulta-atual' }), gateEnvio: () => ({ aceito: true, provaRef: 'fixture:gate-sem-browser' }) };
  const inicial = operarLote(dados, 'iniciar', { frentes, leituraRegrasRef: 'fixture:regras-lidas', filaInicial: { ids, provaRef: 'fixture:fila-inicial' } });
  const fazer = (acao, args = {}, extras = {}) => operarLote(dados, acao, { rodadaId: inicial.rodadaId, ...args }, { ...deps, ...extras });
  return { dados, deps, fazer, rodadaId: inicial.rodadaId, fila: ids => { atual = ids; }, plano: () => planejarLote(dados, deps) };
}
const fixar = (f, id, extras = {}) => f.fazer('fixar', { id, autor: 'aplicador-a', pacoteHash: H,
  fontes: [{ ref: 'fixture:fonte', hash: J }], observacaoAlvoRef: 'fixture:formulario-atual', ...extras }).vaga.pacote.hash;
function enviar(f, id) {
  const pacoteHash = fixar(f, id);
  f.fazer('revisar', { id, pacoteHash, revisor: 'revisor-b', observacaoAlvoRef: 'fixture:formulario-atual', aprovada: true, provaRef: 'fixture:parecer' });
  const aceite = f.fazer('liberar_envio', { id, pacoteHash });
  assert.equal(aceite.liberadoSubmit, false);
  assert.equal(aceite.vaga.estado, 'liberada');
  f.fazer('confirmar_envio', { id, pacoteHash, provaRef: 'fixture:confirmacao-simulada' });
}

test('cinco vagas: perguntas 1/3/5 aguardam, 2/4 seguem antes do bloco final', t => {
  const f = fixture(t);
  assert.throws(() => fixar(f, 'ats:2'), /COLETA_ANTES_APLICACAO/);
  f.fazer('captura', { estado: 'encerrada', provaRef: 'fixture:captura-encerrada', integracaoRef: 'fixture:local-notion-conferidos', arquivosRef: 'fixture:arquivos-salvos' });
  for (const n of [1, 3, 5]) f.fazer('atualizar', { id: `ats:${n}`, estado: 'aguardando_pessoa', provaRef: `fixture:pergunta-${n}` });
  assert.equal(f.plano().podePerguntar, false);
  assert.deepEqual(f.plano().perguntasPendentes, []);
  enviar(f, 'ats:2');
  assert.equal(f.plano().podePerguntar, false);
  enviar(f, 'ats:4');
  assert.equal(f.plano().capturaPendente, false);
  assert.equal(f.plano().podePerguntar, true);
  assert.deepEqual(f.plano().perguntasPendentes.map(p => p.id), ['ats:1', 'ats:3', 'ats:5']);
  assert.equal(f.plano().podeOferecerMelhorias, false);
  assert.throws(() => f.fazer('melhorias', { frente: 'aplicacao', aceite: true, provaRef: 'fixture:cedo' }), /TRABALHO_INDEPENDENTE_PENDENTE/);
  f.fazer('perguntas', { estado: 'apresentada', provaRef: 'fixture:cartoes-1-3-5' });
  assert.throws(() => f.fazer('perguntas', { estado: 'encerrada', provaRef: 'fixture:ainda-sem-resposta' }), /RESPOSTAS_PESSOAIS_PENDENTES/);
  f.fazer('perguntas', { estado: 'impedida', provaRef: 'fixture:sem-respostas-ao-encerrar' });
  assert.equal(f.fazer('melhorias', { frente: 'aplicacao', aceite: false, provaRef: 'fixture:recusa-desta-rodada' }).liberadoSubmit, false);
  assert.equal(f.plano().melhorias.estado, 'recusada');
  assert.throws(() => f.fazer('melhorias', { frente: 'aplicacao', aceite: true, provaRef: 'fixture:outra' }), /ACEITE_MELHORIAS_INVALIDO/);
});

test('A em revisão não impede B preparar; aceite exato de A não libera B e correção invalida A', t => {
  const f = fixture(t, ['ats:A', 'ats:B'], ['aplicacao']);
  const a = fixar(f, 'ats:A');
  f.fazer('atualizar', { id: 'ats:B', estado: 'preparando', provaRef: 'fixture:rascunho-B' });
  assert.deepEqual(f.plano().trabalhoIndependente.map(v => v.estado), ['aguardando_revisao', 'preparando']);
  assert.throws(() => f.fazer('revisar', { id: 'ats:A', pacoteHash: a, revisor: 'aplicador-a', observacaoAlvoRef: 'fixture:formulario-atual', aprovada: true, provaRef: 'fixture:propria' }), /REVISAO_INDEPENDENTE/);
  assert.throws(() => f.fazer('revisar', { id: 'ats:A', pacoteHash: a, revisor: 'revisor-b', observacaoAlvoRef: 'fixture:outro-alvo', aprovada: true, provaRef: 'fixture:errado' }), /PACOTE_DIVERGENTE/);
  f.fazer('revisar', { id: 'ats:A', pacoteHash: a, revisor: 'revisor-b', observacaoAlvoRef: 'fixture:formulario-atual', aprovada: true, provaRef: 'fixture:parecer' });
  f.fazer('liberar_envio', { id: 'ats:A', pacoteHash: a });
  assert.throws(() => f.fazer('liberar_envio', { id: 'ats:B', pacoteHash: a }), /REVISAO_EXATA/);
  const corrigido = fixar(f, 'ats:A', { pacoteHash: J });
  assert.notEqual(corrigido, a);
  assert.throws(() => f.fazer('confirmar_envio', { id: 'ats:A', pacoteHash: a, provaRef: 'fixture:antiga' }), /ACEITE_EXATO/);
  assert.throws(() => f.fazer('liberar_envio', { id: 'ats:A', pacoteHash: corrigido }), /REVISAO_EXATA/);
  assert.equal(f.plano().podePerguntar, false);
});

test('fila atual é consultada: vaga incremental desconhecida bloqueia final e exige integração confirmada', t => {
  const f = fixture(t, [], ['aplicacao']);
  assert.equal(f.plano().podePerguntar, true);
  f.fila(['ats:nova']);
  assert.equal(f.plano().podePerguntar, false);
  assert.deepEqual(f.plano().naoPercorridas, ['ats:nova']);
  assert.throws(() => f.fazer('integrar', { confirmadas: { ids: ['ats:inventada'], provaRef: 'fixture:nao-gravada' } }), /INTEGRACAO_NAO_CONFIRMADA/);
  f.fazer('integrar', { confirmadas: { ids: ['ats:nova'], provaRef: 'fixture:confirmada' } });
  f.fazer('atualizar', { id: 'ats:nova', estado: 'aguardando_pessoa', provaRef: 'fixture:pergunta' });
  assert.equal(f.plano().podePerguntar, true);
  assert.throws(() => planejarLote(f.dados), /CONSULTA_FILA_OBRIGATORIA/);
});

test('leitura de regras, posse e rodada exata são exigidas; nenhum campo preenchido confirma envio', t => {
  const dados = fs.mkdtempSync(path.join(raiz, 'data', 'rodada-lote-guard-test-'));
  t.after(() => fs.rmSync(dados, { force: true, recursive: true }));
  assert.throws(() => operarLote(dados, 'iniciar', { frentes: ['aplicacao'], filaInicial: { ids: [], provaRef: 'fixture:fila' } }), /LEITURA_REGRAS/);
  const f = fixture(t, ['ats:A'], ['aplicacao']);
  assert.throws(() => f.fazer('atualizar', { rodadaId: 'outra', id: 'ats:A', estado: 'preparando', provaRef: 'fixture:x' }), /RODADA_DIVERGENTE/);
  assert.throws(() => f.fazer('confirmar_envio', { id: 'ats:A', pacoteHash: H, provaRef: 'fixture:campos-preenchidos' }), /ACEITE_EXATO/);
  const { token } = operar(f.dados, 'iniciar', { dono: 'outra-sessao' });
  assert.throws(() => f.fazer('atualizar', { id: 'ats:A', estado: 'preparando', provaRef: 'fixture:x' }), /POSSE_NEGADA/);
  operar(f.dados, 'encerrar', { token });
});

test('resumo da coleta sai no formato aprovado, sem travessão', () => {
  assert.equal(resumoColeta({ encontradas: 48, compativeis: 12, descartadas: 36 }), [
    'Coleta concluída ✅', '',
    '| Resultado | Vagas |', '|---|---:|',
    '| 🔎 Encontradas | 48 |',
    '| 🎯 Compatíveis (adicionadas à fila) | 12 |',
    '| 🗑️ Descartadas (fora do perfil, encerradas, duplicadas ou já conhecidas) | 36 |',
  ].join('\n'));
  assert.doesNotMatch(resumoColeta({ encontradas: 1, compativeis: 1, descartadas: 0 }), /[—–]/);
});

test('coleta com gravação pendente não se apresenta como concluída e não conta a pendência como fila', () => {
  const s = resumoColeta({ encontradas: 8, compativeis: 3, descartadas: 3, pendentesGravacao: 2 });
  assert.match(s, /^Coleta com gravação pendente ⚠️/);
  assert.doesNotMatch(s, /Coleta concluída/);
  assert.match(s, /🎯 Compatíveis \(adicionadas à fila\) \| 3 \|/);
  assert.match(s, /2 vagas compatíveis aguardam gravação na fila\.$/);
  assert.match(resumoColeta({ encontradas: 1, compativeis: 0, descartadas: 0, pendentesGravacao: 1 }), /1 vaga compatível aguarda gravação/);
});

test('resumo da coleta recusa soma que não fecha, número inválido e campo antigo', () => {
  for (const c of [{ encontradas: 48, compativeis: 12, descartadas: 35 }, { encontradas: 2, compativeis: 3, descartadas: -1 },
    { encontradas: 1.5, compativeis: 1, descartadas: 0.5 }, { encontradas: NaN, compativeis: 0, descartadas: 0 }, {}]) {
    assert.throws(() => resumoColeta(c), /CONTAGENS_INCOMPATIVEIS/);
  }
  assert.throws(() => resumoColeta({ encontradas: 8, compativeis: 5, adicionadas: 3, descartadas: 3 }), /CAMPO_DESCONHECIDO/);
  for (const entrada of [null, undefined, [], 'x', Object.create({ encontradas: 1, compativeis: 1, descartadas: 0 })]) {
    assert.throws(() => resumoColeta(entrada), /ENTRADA_INVALIDA/);
  }
});

test('CLI aceita stdin e arquivo sem ecoar payload nem erros com dados pessoais', t => {
  const f = fixture(t, [], ['aplicacao']);
  const cli = path.join(raiz, 'scripts', 'rodada-lote.mjs');
  const r = spawnSync(process.execPath, [cli, 'planejar', '--dados', f.dados], { input: JSON.stringify({ filaAtual: { ids: [], provaRef: 'fixture:fila' }, segredo: 'NAO-ECOAR-SEGREDO' }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); assert.doesNotMatch(r.stdout, /NAO-ECOAR/);
  const entrada = path.join(f.dados, 'input.json'); fs.writeFileSync(entrada, '{"segredo":"NAO-ECOAR-SEGREDO"');
  const e = spawnSync(process.execPath, [cli, 'planejar', '--dados', f.dados, '--arquivo', entrada], { encoding: 'utf8' });
  assert.notEqual(e.status, 0); assert.doesNotMatch(e.stderr, /NAO-ECOAR|input.json/);
});

test('aceite de melhorias vale só nesta rodada; encerramento preserva cobertura histórica', t => {
  const f = fixture(t, [], ['aplicacao']);
  f.fazer('melhorias', { frente: 'aplicacao', aceite: true, provaRef: 'fixture:aceite-rodada-um' });
  assert.equal(f.plano().podeOferecerMelhorias, false);
  f.fazer('concluir_melhorias', { frente: 'aplicacao', estado: 'concluida', provaRef: 'fixture:correcao-testada' });
  f.fazer('encerrar', { provaRef: 'fixture:fim-rodada-um' });
  const nova = operarLote(f.dados, 'iniciar', { frentes: ['aplicacao'], leituraRegrasRef: 'fixture:releitura', filaInicial: { ids: [], provaRef: 'fixture:fila-nova' } });
  assert.notEqual(nova.rodadaId, f.rodadaId);
  const plano = planejarLote(f.dados, f.deps);
  assert.equal(plano.melhorias.estado, 'nao_oferecida');
  const salvo = JSON.parse(fs.readFileSync(path.join(f.dados, 'rodada-lote.json'), 'utf8'));
  assert.equal(salvo.historico[0].rodadaId, f.rodadaId);
  assert.throws(() => f.fazer('melhorias', { frente: 'aplicacao', aceite: true, provaRef: 'fixture:aceite-antigo' }), /RODADA_DIVERGENTE/);
});

test('gate externo pode recusar envio e hashes iguais de conteúdo não confundem duas vagas', t => {
  const f = fixture(t, ['ats:A', 'ats:B'], ['aplicacao']);
  const a = fixar(f, 'ats:A'), b = fixar(f, 'ats:B');
  assert.notEqual(a, b);
  f.fazer('revisar', { id: 'ats:A', pacoteHash: a, revisor: 'revisor-b', observacaoAlvoRef: 'fixture:formulario-atual', aprovada: true, provaRef: 'fixture:parecer' });
  assert.throws(() => f.fazer('liberar_envio', { id: 'ats:A', pacoteHash: a }, { gateEnvio: undefined }), /GATE_ENVIO_OBRIGATORIO/);
  assert.throws(() => f.fazer('liberar_envio', { id: 'ats:A', pacoteHash: a }, { gateEnvio: () => ({ aceito: false }) }), /GATE_ENVIO_RECUSADO/);
  assert.equal(f.plano().trabalhoIndependente.find(v => v.id === 'ats:A').estado, 'revisada');
});

test('ambas exigem coleta salva e conferida; impedimento não libera aplicação e parcial exige prova', t => {
  const f = fixture(t, ['ats:A']);
  assert.equal(f.plano().podeAplicar, false);
  assert.throws(() => f.fazer('atualizar', { id: 'ats:A', estado: 'preparando', provaRef: 'fixture:cedo' }), /COLETA_ANTES_APLICACAO/);
  assert.throws(() => f.fazer('captura', { estado: 'encerrada', provaRef: 'fixture:apenas-tempo' }), /PROVA_INTEGRACAO_OBRIGATORIA/);
  f.fazer('captura', { estado: 'impedida', provaRef: 'fixture:login' });
  assert.equal(f.plano().podeAplicar, false);
  assert.throws(() => f.fazer('captura', { estado: 'encerrada', provaRef: 'fixture:parcial', integracaoRef: 'fixture:conferida' }), /PROVA_ARQUIVOS_OBRIGATORIA/);
  assert.throws(() => f.fazer('captura', { estado: 'encerrada', provaRef: 'fixture:parcial', integracaoRef: 'fixture:conferida', arquivosRef: 'fixture:salvos', cobertura: 'parcial' }), /LIMITE_COBERTURA_OBRIGATORIO/);
  f.fazer('captura', { estado: 'encerrada', provaRef: 'fixture:parcial', integracaoRef: 'fixture:destinos-validos-conferidos', arquivosRef: 'fixture:salvos', cobertura: 'parcial', limiteRef: 'fixture:fonte-inacessivel' });
  assert.equal(f.plano().podeAplicar, true);
  assert.equal(f.plano().capturaPendente, false);
  f.fazer('atualizar', { id: 'ats:A', estado: 'preparando', provaRef: 'fixture:rascunho' });
  assert.equal(f.plano().trabalhoIndependente[0].estado, 'preparando');
});

test('respostas e retomadas encerram fase antes das melhorias sem repetir candidaturas recebidas', t => {
  const f = fixture(t, ['ats:A', 'ats:B'], ['aplicacao']);
  f.fazer('atualizar', { id: 'ats:A', estado: 'aguardando_pessoa', provaRef: 'fixture:pergunta-A' });
  enviar(f, 'ats:B');
  f.fazer('perguntas', { estado: 'apresentada', provaRef: 'fixture:cartao-A' });
  enviar(f, 'ats:A');
  assert.equal(f.plano().podeOferecerMelhorias, false);
  f.fazer('perguntas', { estado: 'encerrada', provaRef: 'fixture:resposta-e-retomada-concluidas' });
  assert.equal(f.plano().podeOferecerMelhorias, true);
  assert.throws(() => fixar(f, 'ats:B'), /VAGA_TERMINAL/);
});

test('coleta isolada encerra após integração sem exigir percorrer formulários nem oferecer melhorias', t => {
  const f = fixture(t, ['ats:A'], ['coleta']);
  f.fazer('captura', { estado: 'encerrada', provaRef: 'fixture:captura', integracaoRef: 'fixture:quadro-conferido', arquivosRef: 'fixture:arquivos' });
  assert.equal(f.plano().podeAplicar, false);
  assert.equal(f.plano().podeOferecerMelhorias, false);
  assert.throws(() => f.fazer('melhorias', { aceite: true, provaRef: 'fixture:nao-oferecer' }), /MELHORIAS_SOMENTE_APLICACAO/);
  assert.throws(() => f.fazer('atualizar', { id: 'ats:A', estado: 'preparando', provaRef: 'fixture:nao-aplicar' }), /APLICACAO_NAO_SELECIONADA/);
  f.fazer('encerrar', { provaRef: 'fixture:fim-coleta' });
  assert.equal(f.plano().estado, 'encerrada');
});

test('aceite de melhorias conserva trabalho pendente e rodada encerrada não libera aplicação', t => {
  const f = fixture(t, [], ['aplicacao']);
  f.fazer('melhorias', { aceite: true, provaRef: 'fixture:aceite' });
  assert.equal(f.plano().podeEncerrar, false);
  assert.throws(() => f.fazer('encerrar', { provaRef: 'fixture:cedo' }), /FECHAMENTO_PENDENTE/);
  const arquivo = path.join(f.dados, 'rodada-lote.json');
  assert.equal(JSON.parse(fs.readFileSync(arquivo, 'utf8')).melhorias.estado, 'aceita');
  f.fazer('concluir_melhorias', { estado: 'impedida', provaRef: 'fixture:impedimento-real' });
  f.fazer('encerrar', { provaRef: 'fixture:fechamento-com-impedimento' });
  assert.equal(f.plano().podeAplicar, false);
  assert.equal(f.plano().podePerguntar, false);
  assert.equal(f.plano().podeEncerrar, false);
});

test('conclusão de melhorias reconsulta a fila e recusa trabalho surgido ou retomado após o aceite', t => {
  const f = fixture(t, [], ['aplicacao']);
  f.fazer('melhorias', { aceite: true, provaRef: 'fixture:aceite-antes-da-nova-vaga' });
  f.fila(['ats:nova']);
  assert.throws(() => f.fazer('concluir_melhorias', { estado: 'concluida', provaRef: 'fixture:fronteira-obsoleta' }), /TRABALHO_INDEPENDENTE_PENDENTE/);
  f.fazer('integrar', { confirmadas: { ids: ['ats:nova'], provaRef: 'fixture:nova-confirmada' } });
  f.fazer('atualizar', { id: 'ats:nova', estado: 'preparando', provaRef: 'fixture:trabalho-retomado' });
  assert.throws(() => f.fazer('concluir_melhorias', { estado: 'impedida', provaRef: 'fixture:nao-sobrepoe-trabalho' }), /TRABALHO_INDEPENDENTE_PENDENTE/);
  f.fazer('atualizar', { id: 'ats:nova', estado: 'aguardando_pessoa', provaRef: 'fixture:nova-pergunta' });
  assert.throws(() => f.fazer('concluir_melhorias', { estado: 'concluida', provaRef: 'fixture:fase-nao-terminou' }), /TRABALHO_INDEPENDENTE_PENDENTE/);
  f.fazer('perguntas', { estado: 'apresentada', provaRef: 'fixture:novo-cartao' });
  f.fazer('perguntas', { estado: 'impedida', provaRef: 'fixture:sem-resposta-ao-fechar' });
  f.fazer('concluir_melhorias', { estado: 'concluida', provaRef: 'fixture:fronteira-reavaliada' });
  assert.equal(f.plano().melhorias.estado, 'concluida');
});

test('resumo da aplicação usa o mesmo formato e só se declara concluído sem pendência', () => {
  assert.equal(resumoAplicacao({ total: 12, enviadas: 10, pendentes: 0, naoEnviadas: 2 }), [
    'Aplicação concluída ✅', '',
    '| Resultado | Vagas |', '|---|---:|',
    '| 📨 Enviadas (recebimento confirmado) | 10 |',
    '| ⏳ Pendentes (aguardando você ou o site) | 0 |',
    '| 🚫 Não enviadas (encerradas, fora do perfil ou impedidas) | 2 |',
  ].join('\n'));
  const comPendencia = resumoAplicacao({ total: 5, enviadas: 2, pendentes: 2, naoEnviadas: 1 });
  assert.match(comPendencia, /^Aplicação encerrada com pendências ⏳/);
  assert.doesNotMatch(comPendencia, /concluída|[—–]/);
  assert.match(resumoAplicacao({ total: 0, enviadas: 0, pendentes: 0, naoEnviadas: 0 }), /📨 Enviadas \(recebimento confirmado\) \| 0/);
});

test('resumo da aplicação recusa soma incorreta, números inválidos e campos fora do contrato', () => {
  const base = { total: 3, enviadas: 1, pendentes: 1, naoEnviadas: 1 };
  for (const alteracao of [{ total: 4 }, { enviadas: -1 }, { pendentes: 0.5 }, { total: NaN }, { naoEnviadas: Infinity }]) {
    assert.throws(() => resumoAplicacao({ ...base, ...alteracao }), /CONTAGENS_INCOMPATIVEIS/);
  }
  assert.throws(() => resumoAplicacao({ ...base, motivosPendentes: ['resposta pessoal'] }), /CAMPO_DESCONHECIDO/);
});

test('terminal mostra uma linha por vaga, numerada a partir de 1', () => {
  assert.equal(linhaProgressoAplicacao({ numero: 1, vaga: 'Senior Product Designer' }), 'Aplicando na vaga 1: Senior Product Designer');
  assert.equal(linhaProgressoAplicacao({ numero: 2, vaga: '  Analista   Financeiro ' }), 'Aplicando na vaga 2: Analista Financeiro');
  for (const numero of [0, -1, 1.5, '1']) assert.throws(() => linhaProgressoAplicacao({ numero, vaga: 'X' }), /NUMERO_VAGA_INVALIDO/);
  for (const vaga of ['', '  ', 'A\nB', null]) assert.throws(() => linhaProgressoAplicacao({ numero: 1, vaga }), /NOME_VAGA_INVALIDO/);
  assert.equal(linhaProgressoAplicacao({ numero: 3, vaga: 'Product Designer', empresa: 'Acme' }), 'Aplicando na vaga 3: Product Designer · Acme');
  for (const empresa of ['', null]) assert.equal(linhaProgressoAplicacao({ numero: 1, vaga: 'X', empresa }), 'Aplicando na vaga 1: X');
  for (const empresa of ['  ', 'A\nB', 7]) assert.throws(() => linhaProgressoAplicacao({ numero: 1, vaga: 'X', empresa }), /EMPRESA_INVALIDA/);
  assert.throws(() => linhaProgressoAplicacao({ numero: 1, vaga: 'A\u001b[31mB' }), /NOME_VAGA_INVALIDO/);
  assert.throws(() => linhaProgressoAplicacao({ numero: 1, vaga: 'X', etapa: 'upload' }), /CAMPO_DESCONHECIDO/);
});

test('passe de melhorias da coleta só registra; o da aplicação pergunta e só altera com aceite', () => {
  const coleta = politicaMelhorias('coleta');
  assert.deepEqual([coleta.registraAchados, coleta.ofereceAPessoa, coleta.alteraArquivos, coleta.levaAchadosPara], [true, false, false, 'aplicacao']);
  const aplicacao = politicaMelhorias('aplicacao');
  assert.deepEqual([aplicacao.ofereceAPessoa, aplicacao.exigeAceite, aplicacao.alteraArquivos], [true, true, 'somente_com_aceite']);
  assert.throws(() => { coleta.ofereceAPessoa = true; }, TypeError);
  for (const fase of ['ciclo', '', undefined, 'toString']) assert.throws(() => politicaMelhorias(fase), /FASE_MELHORIAS_INVALIDA/);
});

test('CLI imprime resumos e progresso e devolve só o código de erro', () => {
  const cli = path.join(raiz, 'scripts', 'rodada-lote.mjs');
  const rodar = (acao, entrada) => spawnSync(process.execPath, [cli, acao], { input: JSON.stringify(entrada), encoding: 'utf8' });
  assert.match(rodar('resumo_coleta', { encontradas: 48, compativeis: 12, descartadas: 36 }).stdout, /^Coleta concluída ✅/);
  assert.match(rodar('resumo_aplicacao', { total: 1, enviadas: 1, pendentes: 0, naoEnviadas: 0 }).stdout, /^Aplicação concluída ✅/);
  assert.equal(rodar('progresso_aplicacao', { numero: 3, vaga: 'Product Designer' }).stdout, 'Aplicando na vaga 3: Product Designer\n');
  const e = rodar('progresso_aplicacao', { numero: 0, vaga: 'NAO-ECOAR-SEGREDO' });
  assert.notEqual(e.status, 0);
  assert.equal(e.stderr.trim(), '{"ok":false,"erro":"NUMERO_VAGA_INVALIDO"}');
});
