// Spec 015: coleta 2 (LinkedIn assistido) depois da aplicação, no controle da rodada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { operarLote, planejarLote, resumoColeta, resumoAplicacao, resumoColeta2Fora } from '../src/rodada-lote.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = 'a'.repeat(64), J = 'b'.repeat(64);
const CAPTURA = { estado: 'encerrada', provaRef: 'fixture:captura', integracaoRef: 'fixture:quadro-conferido', arquivosRef: 'fixture:arquivos' };

function fixture(t, { ids = [], frentes = ['coleta', 'aplicacao'], coleta2Habilitada = true, origem } = {}) {
  const dados = fs.mkdtempSync(path.join(raiz, 'data', 'rodada-lote-c2-test-'));
  t.after(() => fs.rmSync(dados, { force: true, recursive: true }));
  let atual = [...ids];
  const deps = { consultarFila: () => ({ ids: atual, provaRef: 'fixture:consulta-atual' }), gateEnvio: () => ({ aceito: true, provaRef: 'fixture:gate' }) };
  const inicial = operarLote(dados, 'iniciar', { frentes, coleta2Habilitada, ...(origem ? { origem } : {}), leituraRegrasRef: 'fixture:regras', filaInicial: { ids, provaRef: 'fixture:fila-inicial' } });
  const fazer = (acao, args = {}) => operarLote(dados, acao, { rodadaId: inicial.rodadaId, ...args }, deps);
  return { dados, deps, fazer, fila: novo => { atual = novo; }, plano: () => planejarLote(dados, deps), arquivo: () => JSON.parse(fs.readFileSync(path.join(dados, 'rodada-lote.json'), 'utf8')) };
}
function enviar(f, id) {
  const h = f.fazer('fixar', { id, autor: 'aplicador-a', pacoteHash: H, fontes: [{ ref: 'fixture:fonte', hash: J }], observacaoAlvoRef: 'fixture:form' }).vaga.pacote.hash;
  f.fazer('revisar', { id, pacoteHash: h, revisor: 'revisor-b', observacaoAlvoRef: 'fixture:form', aprovada: true, provaRef: 'fixture:parecer' });
  f.fazer('liberar_envio', { id, pacoteHash: h });
  f.fazer('confirmar_envio', { id, pacoteHash: h, provaRef: 'fixture:recibo' });
}
const decidir = (f, decisao, extra = {}) => f.fazer('coleta2_decidir', { decisao, provaRef: `fixture:${decisao}`, ...extra });

test('a pergunta só é devida com a coleta principal encerrada e a aplicação terminada', t => {
  const f = fixture(t, { ids: ['ats:A'] });
  assert.equal(f.plano().coleta2.estado, 'pendente');
  assert.equal(f.plano().podeOferecerColeta2, false);
  assert.equal(f.plano().coleta2.motivoPendente, 'coleta_principal_nao_encerrada');
  f.fazer('captura', CAPTURA);
  assert.equal(f.plano().coleta2.motivoPendente, 'aplicacao_nao_concluida');
  assert.throws(() => decidir(f, 'aceita'), /COLETA2_NAO_DEVIDA/);
  f.fazer('atualizar', { id: 'ats:A', estado: 'preparando', provaRef: 'fixture:rascunho' });
  assert.equal(f.plano().podeOferecerColeta2, false);
  enviar(f, 'ats:A');
  assert.equal(f.plano().podeOferecerColeta2, true);
  assert.equal(f.plano().coleta2.motivoPendente, null);
});

test('pendência (bloqueada ou aguardando pessoa) conta como aplicação terminada; preparando e liberada não', t => {
  const f = fixture(t, { ids: ['ats:A', 'ats:B'] });
  f.fazer('captura', CAPTURA);
  f.fazer('atualizar', { id: 'ats:A', estado: 'bloqueada', provaRef: 'fixture:site-fora' });
  f.fazer('atualizar', { id: 'ats:B', estado: 'aguardando_pessoa', provaRef: 'fixture:pergunta' });
  assert.equal(f.plano().podeOferecerColeta2, false);
  f.fazer('perguntas', { estado: 'apresentada', provaRef: 'fixture:cartao' });
  f.fazer('perguntas', { estado: 'impedida', provaRef: 'fixture:sem-resposta' });
  assert.equal(f.plano().podeOferecerColeta2, true);
});

test('vaga liberada para envio (ainda sem recibo) é trabalho aberto: a pergunta não aparece', t => {
  const f = fixture(t, { ids: ['ats:A'] });
  f.fazer('captura', CAPTURA);
  const h = f.fazer('fixar', { id: 'ats:A', autor: 'aplicador-a', pacoteHash: H, fontes: [{ ref: 'fixture:fonte', hash: J }], observacaoAlvoRef: 'fixture:form' }).vaga.pacote.hash;
  f.fazer('revisar', { id: 'ats:A', pacoteHash: h, revisor: 'revisor-b', observacaoAlvoRef: 'fixture:form', aprovada: true, provaRef: 'fixture:parecer' });
  f.fazer('liberar_envio', { id: 'ats:A', pacoteHash: h });
  assert.equal(f.plano().podeOferecerColeta2, false);
});

test('coleta principal impedida não oferece a pergunta nem deixa fechar a rodada', t => {
  const f = fixture(t, { ids: [] });
  f.fazer('captura', { estado: 'impedida', provaRef: 'fixture:login' });
  assert.equal(f.plano().podeOferecerColeta2, false);
  assert.equal(f.plano().coleta2.motivoPendente, 'coleta_principal_nao_encerrada');
  assert.throws(() => f.fazer('encerrar', { provaRef: 'fixture:fim' }), /FECHAMENTO_PENDENTE/);
});

test('a rodada só fecha com a coleta 2 decidida; recusa fecha', t => {
  const f = fixture(t, { ids: [] });
  f.fazer('captura', CAPTURA);
  assert.equal(f.plano().podeEncerrar, false);
  assert.throws(() => f.fazer('encerrar', { provaRef: 'fixture:fim' }), /FECHAMENTO_PENDENTE/);
  decidir(f, 'recusada');
  assert.equal(f.plano().podeEncerrar, true);
  assert.throws(() => decidir(f, 'aceita'), /COLETA2_JA_DECIDIDA/);
  f.fazer('encerrar', { provaRef: 'fixture:fim' });
  assert.equal(f.arquivo().coleta2.estado, 'recusada');
});

test('rodada agendada: aceita é recusada e o fechamento grava sem resposta', t => {
  const f = fixture(t, { ids: [], origem: 'agendada' });
  f.fazer('captura', CAPTURA);
  assert.equal(f.plano().podeOferecerColeta2, false);
  assert.equal(f.plano().coleta2.estado, 'sem_resposta');
  assert.throws(() => decidir(f, 'aceita'), /DECISAO_INVALIDA_NA_AGENDADA/);
  assert.equal(f.plano().podeEncerrar, true);
  f.fazer('encerrar', { provaRef: 'fixture:fim' });
  assert.equal(f.arquivo().coleta2.estado, 'sem_resposta');
});

test('origem inválida é recusada e o padrão é manual', t => {
  const f = fixture(t);
  assert.equal(f.plano().origem, 'manual');
  assert.throws(() => operarLote(f.dados, 'encerrar', { rodadaId: 'x' }, f.deps), /RODADA_DIVERGENTE/);
  const dir = fs.mkdtempSync(path.join(raiz, 'data', 'rodada-lote-c2-origem-'));
  t.after(() => fs.rmSync(dir, { force: true, recursive: true }));
  assert.throws(() => operarLote(dir, 'iniciar', { frentes: ['coleta'], origem: 'robo', leituraRegrasRef: 'fixture:r', filaInicial: { ids: [], provaRef: 'fixture:f' } }), /ORIGEM_INVALIDA/);
});

test('LinkedIn desligado ou sem frente de coleta: coleta 2 dispensada e nada muda no fechamento', t => {
  const desligado = fixture(t, { coleta2Habilitada: false });
  assert.deepEqual([desligado.plano().coleta2.estado, desligado.plano().coleta2.motivo], ['dispensada', 'linkedin_desligado']);
  const semColeta = fixture(t, { frentes: ['aplicacao'] });
  assert.equal(semColeta.plano().coleta2.motivo, 'frente_coleta_ausente');
  assert.throws(() => semColeta.fazer('coleta2_decidir', { decisao: 'aceita', provaRef: 'fixture:x' }), /COLETA2_NAO_APLICAVEL/);
  assert.equal(semColeta.plano().podeEncerrar, true);
});

test('janela de hoje já feita: dispensada só com o motivo permitido', t => {
  const f = fixture(t);
  f.fazer('captura', CAPTURA);
  assert.throws(() => decidir(f, 'dispensada', { motivo: 'linkedin_desligado' }), /MOTIVO_COLETA2_INVALIDO/);
  decidir(f, 'dispensada', { motivo: 'ja_feita_hoje' });
  assert.equal(f.arquivo().coleta2.motivo, 'ja_feita_hoje');
  assert.equal(f.plano().podeEncerrar, true);
});

test('sim, coleta 2 grava vagas novas com origem própria; sem decisão sobre elas a rodada não fecha', t => {
  const f = fixture(t, { ids: ['ats:A'] });
  f.fazer('captura', CAPTURA);
  enviar(f, 'ats:A');
  decidir(f, 'aceita');
  assert.equal(f.plano().podeEncerrar, false);
  assert.throws(() => f.fazer('coleta2_captura', { estado: 'encerrada', provaRef: 'fixture:janela', integracaoRef: 'fixture:i' }), /PROVA_ARQUIVOS_OBRIGATORIA/);
  f.fila(['ats:A', 'li:1', 'li:2']);
  f.fazer('coleta2_captura', { ...CAPTURA, provaRef: 'fixture:janela' });
  const p = f.plano();
  assert.deepEqual(p.novasColeta2, ['li:1', 'li:2']);
  assert.equal(p.coleta2.estado, 'encerrada');
  assert.deepEqual(p.naoPercorridas, ['li:1', 'li:2']);
  assert.equal(p.podePerguntar, false);
  assert.equal(p.podeEncerrar, false);
  assert.equal(f.arquivo().vagas['li:1'].origem, 'coleta2');
});

test('não aplicar agora: adiar tira as vagas da coleta 2 de todas as listas e a rodada fecha', t => {
  const f = fixture(t, { ids: [] });
  f.fazer('captura', CAPTURA);
  decidir(f, 'aceita');
  f.fila(['li:1', 'li:2']);
  f.fazer('coleta2_captura', CAPTURA);
  assert.equal(f.plano().podeAplicar, false);
  f.fazer('adiar', { provaRef: 'fixture:nao-agora' });
  const p = f.plano();
  assert.deepEqual([p.naoPercorridas, p.ordemAplicacao, p.podeAplicar, p.podePerguntar], [[], [], false, true]);
  assert.equal(p.coleta2.adiadas, 2);
  assert.equal(p.podeEncerrar, true);
  for (const acao of ['atualizar', 'fixar']) assert.throws(() => f.fazer(acao, { id: 'li:1', estado: 'preparando', provaRef: 'fixture:x' }), /VAGA_ADIADA/);
  f.fazer('encerrar', { provaRef: 'fixture:fim' });
  assert.equal(f.arquivo().vagas['li:1'].estado, 'adiada');
});

test('agendada: integração pendente de outro dia entra sem pergunta, e as vagas ficam para a próxima rodada', t => {
  const f = fixture(t, { ids: [], origem: 'agendada' });
  f.fazer('captura', CAPTURA);
  f.fila(['li:9']);
  assert.deepEqual(f.plano().naoPercorridas, ['li:9']);
  assert.equal(f.plano().podeEncerrar, false);
  assert.throws(() => f.fazer('coleta2_integrar', { provaRef: 'fixture:integrada', integracaoRef: 'fixture:i' }), /PROVA_ARQUIVOS_OBRIGATORIA/);
  f.fazer('coleta2_integrar', { provaRef: 'fixture:integrada', integracaoRef: 'fixture:quadro', arquivosRef: 'fixture:arquivos' });
  assert.equal(f.plano().coleta2.estado, 'encerrada');
  assert.equal(f.plano().coleta2.motivo, 'so_integracao');
  assert.deepEqual(f.plano().novasColeta2, ['li:9']);
  assert.throws(() => f.fazer('coleta2_integrar', { provaRef: 'x', integracaoRef: 'y', arquivosRef: 'z' }), /COLETA2_NAO_PENDENTE/);
  f.fazer('adiar', { provaRef: 'fixture:ninguem-para-responder' });
  assert.equal(f.plano().podeEncerrar, true);
  f.fazer('encerrar', { provaRef: 'fixture:fim' });
});

test('coleta 2 só integra com a coleta principal encerrada', t => {
  const f = fixture(t, { ids: [] });
  assert.throws(() => f.fazer('coleta2_integrar', { provaRef: 'a', integracaoRef: 'b', arquivosRef: 'c' }), /COLETA_PRINCIPAL_NAO_ENCERRADA/);
});

test('rodada agendada só aceita sem resposta (ou janela já feita), nunca recusa em nome da pessoa', t => {
  const f = fixture(t, { ids: [], origem: 'agendada' });
  f.fazer('captura', CAPTURA);
  for (const decisao of ['recusada', 'aceita']) assert.throws(() => decidir(f, decisao), /DECISAO_INVALIDA_NA_AGENDADA/);
  decidir(f, 'sem_resposta');
  assert.equal(f.plano().podeEncerrar, true);
});

test('sim, aplicar agora: segunda passagem só nas vagas da coleta 2, com perguntas reabertas', t => {
  const f = fixture(t, { ids: ['ats:A'] });
  f.fazer('captura', CAPTURA);
  enviar(f, 'ats:A');
  decidir(f, 'aceita');
  f.fila(['ats:A', 'li:1']);
  f.fazer('coleta2_captura', CAPTURA);
  assert.deepEqual(f.plano().ordemAplicacao, []);
  assert.throws(() => f.fazer('atualizar', { id: 'li:1', estado: 'preparando', provaRef: 'fixture:sem-sim' }), /APLICAR_NOVAS_NAO_AUTORIZADO/);
  f.fazer('aplicar_novas', { provaRef: 'fixture:sim-segunda-pergunta' });
  assert.throws(() => f.fazer('adiar', { provaRef: 'fixture:volta-atras' }), /NOVAS_JA_AUTORIZADAS/);
  assert.deepEqual(f.plano().ordemAplicacao.map(v => v.id), ['li:1']);
  f.fazer('atualizar', { id: 'li:1', estado: 'aguardando_pessoa', provaRef: 'fixture:pergunta-nova' });
  assert.equal(f.plano().podePerguntar, true);
  assert.equal(f.plano().perguntas.estado, 'pendente');
  f.fazer('perguntas', { estado: 'apresentada', provaRef: 'fixture:cartao-2' });
  f.fazer('perguntas', { estado: 'impedida', provaRef: 'fixture:sem-resposta-2' });
  assert.equal(f.plano().podeOferecerMelhorias, true);
  assert.equal(f.plano().podeEncerrar, true);
});

test('adiar exige coleta 2 encerrada e só atinge vagas de origem coleta2', t => {
  const f = fixture(t, { ids: ['ats:A'] });
  f.fazer('captura', CAPTURA);
  assert.throws(() => f.fazer('adiar', { provaRef: 'fixture:x' }), /COLETA2_NAO_ENCERRADA/);
  enviar(f, 'ats:A');
  decidir(f, 'aceita');
  f.fazer('coleta2_captura', CAPTURA);
  f.fazer('adiar', { provaRef: 'fixture:x' });
  assert.equal(f.arquivo().vagas['ats:A'].estado, 'enviada');
});

test('coleta 2 impedida pede a ação, conta como resolvida e pode voltar a encerrada', t => {
  const f = fixture(t, { ids: [] });
  f.fazer('captura', CAPTURA);
  decidir(f, 'aceita');
  assert.throws(() => f.fazer('coleta2_captura', { estado: 'impedida', provaRef: 'fixture:login' }), /ACAO_NECESSARIA_OBRIGATORIA/);
  f.fazer('coleta2_captura', { estado: 'impedida', provaRef: 'fixture:login', acaoRef: 'fixture:entrar-no-linkedin' });
  assert.equal(f.plano().coleta2.estado, 'impedida');
  assert.equal(f.plano().podeEncerrar, true);
  f.fazer('coleta2_captura', CAPTURA);
  assert.equal(f.plano().coleta2.estado, 'encerrada');
});

test('lote anterior à spec 015 é lido como dispensada e segue funcionando', t => {
  const f = fixture(t, { ids: [] });
  const caminho = path.join(f.dados, 'rodada-lote.json');
  const lote = f.arquivo(); delete lote.coleta2; delete lote.origem;
  fs.writeFileSync(caminho, JSON.stringify(lote));
  assert.deepEqual([f.plano().coleta2.estado, f.plano().coleta2.motivo], ['dispensada', 'lote_anterior']);
  f.fazer('captura', CAPTURA);
  assert.equal(f.plano().podeEncerrar, true);
  assert.equal(f.arquivo().coleta2.motivo, 'lote_anterior');
});

test('textos de resumo da coleta 2 e da segunda passagem, sem travessão', () => {
  assert.equal(resumoColeta({ fase: 'coleta2', encontradas: 20, compativeis: 5, descartadas: 15 }), [
    'Coleta 2 (LinkedIn assistido) concluída ✅', '', '| Resultado | Vagas |', '|---|---:|', '| 🔎 Encontradas | 20 |',
    '| 🎯 Compatíveis (adicionadas à fila) | 5 |', '| 🗑️ Descartadas (fora do perfil, encerradas, duplicadas ou já conhecidas) | 15 |'].join('\n'));
  assert.match(resumoColeta({ fase: 'coleta2', encontradas: 3, compativeis: 1, descartadas: 0, pendentesGravacao: 2 }), /^Coleta 2 \(LinkedIn assistido\) com gravação pendente ⚠️/);
  assert.match(resumoAplicacao({ fase: 'coleta2', total: 2, enviadas: 2, pendentes: 0, naoEnviadas: 0 }), /^Aplicação das novas da coleta 2 concluída ✅/);
  assert.match(resumoAplicacao({ fase: 'coleta2', total: 2, enviadas: 1, pendentes: 1, naoEnviadas: 0 }), /^Aplicação das novas da coleta 2 encerrada com pendências ⏳/);
  assert.match(resumoColeta({ encontradas: 1, compativeis: 1, descartadas: 0 }), /^Coleta concluída ✅/);
  assert.throws(() => resumoColeta({ fase: 'outra', encontradas: 0, compativeis: 0, descartadas: 0 }), /FASE_INVALIDA/);
  assert.equal(resumoColeta2Fora({ motivo: 'recusada' }), 'Coleta 2 (LinkedIn assistido) ficou de fora ⏭️\n\nVocê escolheu fechar a rodada sem ela.');
  const frases = {
    sem_resposta: 'A rodada agendada não tinha ninguém para responder, e a coleta 2 só roda com o seu aceite.',
    ja_feita_hoje: 'A janela de hoje já foi feita e integrada em outra rodada.',
    aplicacao_nao_concluida: 'A aplicação ainda não terminou, então a pergunta não foi feita.',
    coleta_principal_nao_encerrada: 'A coleta principal não fechou, e a coleta 2 grava no mesmo quadro.',
  };
  for (const [motivo, frase] of Object.entries(frases)) assert.equal(resumoColeta2Fora({ motivo }), `Coleta 2 (LinkedIn assistido) ficou de fora ⏭️\n\n${frase}`);
  assert.equal(resumoColeta2Fora({ motivo: 'impedida', acao: 'Entrar no LinkedIn pelo painel e avisar.' }), 'Coleta 2 (LinkedIn assistido) parou ⚠️\n\nEntrar no LinkedIn pelo painel e avisar.');
  for (const motivo of ['linkedin_desligado', 'lote_anterior', 'frente_coleta_ausente']) assert.throws(() => resumoColeta2Fora({ motivo }), /MOTIVO_SEM_RESUMO/);
  assert.throws(() => resumoColeta2Fora({ motivo: 'inventado' }), /MOTIVO_COLETA2_INVALIDO/);
  assert.throws(() => resumoColeta2Fora({ motivo: 'impedida' }), /ACAO_NECESSARIA_INVALIDA/);
  assert.throws(() => resumoColeta2Fora({ motivo: 'recusada', acao: 'x' }), /ACAO_SOMENTE_IMPEDIDA/);
  for (const m of ['recusada', ...Object.keys(frases)]) assert.doesNotMatch(resumoColeta2Fora({ motivo: m }), /[—–]/);
});

test('CLI imprime o resumo da coleta 2 fora e devolve só o código de erro', () => {
  const cli = path.join(raiz, 'scripts', 'rodada-lote.mjs');
  const ok = spawnSync(process.execPath, [cli, 'resumo_coleta2_fora'], { input: JSON.stringify({ motivo: 'recusada' }), encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /ficou de fora ⏭️/);
  const ruim = spawnSync(process.execPath, [cli, 'resumo_coleta2_fora'], { input: JSON.stringify({ motivo: 'inventado', segredo: 'NAO-ECOAR' }), encoding: 'utf8' });
  assert.notEqual(ruim.status, 0);
  assert.doesNotMatch(ruim.stderr, /NAO-ECOAR/);
  assert.match(ruim.stderr, /CAMPO_DESCONHECIDO/);
});
