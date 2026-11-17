// Incidente 11 e a rodada inteira: quatro números e uma lista, sem jargão e sem travessão.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resumoRodada, resumoColeta, resumoAplicacao } from '../src/rodada-lote.js';
import { registrar, consolidar, novaRodada, frasePedido, ehPessoal, listar } from '../src/ocorrencias.js';
import { prepararRodada, fecharRodada } from '../src/autonomia.js';
import { operar, _dependencias } from '../src/operacao.js';
import { enfileirar, registrarFalha, marcarGravado } from '../src/fila-notion.js';
import { ingerirDaSessao, registrarConexao, prepararMensagem } from '../src/contatos-posts.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = { ..._dependencias };
function pasta(t) {
  const dados = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'autonomia-resumo-')));
  t.after(() => { Object.assign(_dependencias, original); fs.rmSync(dados, { recursive: true, force: true }); });
  const arq = n => path.join(dados, n);
  return { dados, arquivos: { ocorrencias: arq('ocorrencias-rodada.json'), fila: arq('fila-notion.json'), contatos: arq('contatos-posts.json') }, espelho: arq('notion.json') };
}

test('fechamento: título, tabela de três linhas e, só se houver, a lista', () => {
  assert.equal(resumoRodada({ mapeadas: 42, aplicadas: 7, comErro: 0 }),
    'Rodada concluída ✅\n\n| Resultado | Vagas |\n|---|---:|\n| 🔎 Mapeadas | 42 |\n| 📨 Aplicadas | 7 |\n| ⚠️ Com erro | 0 |');
  const t = resumoRodada({ mapeadas: 42, aplicadas: 7, comErro: 1, precisaDeVoce: ['Responder uma pergunta pessoal da vaga Product Designer (Acme)', 'Autorizar uma mensagem para Fulana'] });
  assert.match(t, /^Rodada concluída com erros ⚠️/);
  assert.match(t, /\| ⚠️ Com erro \| 1 \|\n\nPrecisa de você\n- Responder uma pergunta pessoal da vaga Product Designer \(Acme\)\n- Autorizar uma mensagem para Fulana$/);
  assert.match(resumoRodada({ mapeadas: 1, aplicadas: 0, comErro: 0, precisaDeVoce: ['Fazer um teste'] }), /^Rodada concluída, aguardando você ⏳/);
  assert.ok(!/[—–]/.test(t));
});

test('a lista é curta: mostra seis e conta o resto', () => {
  const itens = Array.from({ length: 9 }, (_, i) => `Item ${i + 1}`);
  const t = resumoRodada({ mapeadas: 1, aplicadas: 1, comErro: 0, precisaDeVoce: itens });
  assert.equal((t.match(/^- /gm) || []).length, 7); assert.match(t, /- e mais 3$/);
});

test('entradas inválidas são recusadas: travessão, multilinha, contagem negativa, campo extra', () => {
  assert.throws(() => resumoRodada({ mapeadas: 1, aplicadas: 1, comErro: 0, precisaDeVoce: ['Fazer isto — agora'] }), /TRAVESSAO_NAO_PERMITIDO/);
  assert.throws(() => resumoRodada({ mapeadas: 1, aplicadas: 1, comErro: 0, precisaDeVoce: ['linha 1\nlinha 2'] }));
  assert.throws(() => resumoRodada({ mapeadas: -1, aplicadas: 1, comErro: 0 }), /CONTAGENS_INCOMPATIVEIS/);
  assert.throws(() => resumoRodada({ mapeadas: 1, aplicadas: 1, comErro: 0, extra: 1 }), /CAMPO_DESCONHECIDO/);
});

test('os resumos de coleta e aplicação ganham erros e pedidos sem mudar quando não vêm', () => {
  const sem = resumoColeta({ encontradas: 10, compativeis: 4, descartadas: 6 });
  assert.ok(!/Com erro|Precisa/.test(sem));
  const com = resumoColeta({ encontradas: 10, compativeis: 4, descartadas: 6, erros: 2, precisaDeVoce: ['Entrar de novo na conta do LinkedIn'] });
  assert.ok(com.startsWith(sem)); assert.match(com, /\n\n⚠️ Com erro: 2\n\nPrecisa de você\n- Entrar de novo na conta do LinkedIn$/);
  const ap = resumoAplicacao({ total: 5, enviadas: 3, pendentes: 1, naoEnviadas: 1, erros: 0 });
  assert.match(ap, /\n\n⚠️ Com erro: 0$/);
});

test('o comando de fechamento usa o mesmo texto', () => {
  const r = spawnSync(process.execPath, [path.join(raiz, 'scripts/rodada-lote.mjs'), 'resumo_rodada'], { input: JSON.stringify({ mapeadas: 3, aplicadas: 2, comErro: 0 }), encoding: 'utf8', cwd: raiz });
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /Mapeadas \| 3 \|/);
});

test('ocorrências: o que se resolveu sozinho não é erro; ato pessoal não é erro, é pedido', t => {
  const { arquivos } = pasta(t); const o = { arquivo: arquivos.ocorrencias };
  registrar({ codigo: 'CAMINHO_INSEGURO', detalhe: 'Drive', resolvida: true, resolucao: 'segundo nome do Drive tolerado' }, o);
  registrar({ codigo: 'CONTROLE_CDP_INDISPONIVEL', resolvida: true, resolucao: 'reconectar' }, o);
  registrar({ codigo: 'FORMULARIO_QUEBRADO', vaga: 'Designer (Acme)' }, o);
  registrar({ codigo: 'ENVIO_RECUSADO', vaga: 'Designer (Acme)' }, o);
  registrar({ codigo: 'RESPOSTA_PESSOAL', vaga: 'PD (Beta)' }, o);
  registrar({ codigo: 'LOGIN', detalhe: 'LinkedIn' }, o);
  registrar({ codigo: 'CAPTCHA', vaga: 'UX (Gama)' }, o);
  const c = consolidar(o);
  assert.equal(c.comErro, 1);
  assert.equal(c.resolvidasSozinhas, 2);
  assert.deepEqual(c.precisaDeVoce, ['Responder uma pergunta pessoal da vaga PD (Beta)', 'Entrar de novo na conta de LinkedIn', 'Resolver uma verificação de segurança (CAPTCHA) na vaga UX (Gama)']);
  assert.throws(() => registrar({ codigo: 'CAPTCHA', resolvida: true }, o), /PESSOAL_NAO_SE_RESOLVE_SOZINHO/);
  assert.throws(() => registrar({ codigo: 'minúsculo' }, o), /CODIGO_INVALIDO/);
  assert.equal(ehPessoal('VIDEO'), true); assert.equal(frasePedido({ codigo: 'VIDEO', vaga: 'X (Y)' }), 'Gravar um vídeo pedido pela vaga X (Y)');
  assert.equal(frasePedido({ codigo: 'FORMULARIO_QUEBRADO' }), null);
});

test('mesmo fato registrado duas vezes conta uma; nova rodada limpa o que é derivado', t => {
  const { arquivos } = pasta(t); const o = { arquivo: arquivos.ocorrencias };
  registrar({ codigo: 'X_FALHA', vaga: 'A' }, o); registrar({ codigo: 'X_FALHA', vaga: 'A' }, o);
  registrar({ codigo: 'Y_DERIVADA', vaga: 'B', derivada: true }, o);
  assert.equal(listar(o).length, 2);
  assert.equal(consolidar(o).comErro, 2);
  novaRodada(o);
  assert.deepEqual(listar(o).map(x => x.codigo), ['X_FALHA']);
});

test('prepara a rodada sozinho: operação órfã, lote antigo, fila parada, mensagem e reinício', async t => {
  const { dados, arquivos } = pasta(t);
  const controle = path.join(dados, 'controle'); fs.mkdirSync(controle);
  fs.writeFileSync(path.join(controle, 'aviso-reinicio.json'), JSON.stringify({ em: '2026-11-16T10:00:00.000Z', rascunhosPerdidos: 2, paginas: [] }));
  // Fila do Notion com um item parado e uma mensagem esperando a pessoa candidata.
  enfileirar([{ idExterno: 'a:1', titulo: 'PD', empresa: 'A', link: 'https://x.test/1' }], { arquivo: arquivos.fila, espelho: path.join(dados, 'notion.json') });
  for (let i = 0; i < 3; i++) registrarFalha('a:1', 'limite do Notion', { arquivo: arquivos.fila });
  const sessao = { observacoes: [{ id: 'o1', cargo: 'Product Designer', empresa: 'Acme', url: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
    contato: { nome: 'Marina', perfil: 'https://www.linkedin.com/in/marina', postLink: 'https://www.linkedin.com/feed/update/urn:li:activity:1', pedido: 'comentario' } }] };
  ingerirDaSessao(sessao, { arquivo: arquivos.contatos });
  const id = Object.keys(JSON.parse(fs.readFileSync(arquivos.contatos, 'utf8')).contatos)[0];
  registrarConexao(id, { provaRef: 'ok' }, { arquivo: arquivos.contatos });
  prepararMensagem(id, { texto: 'Olá, Marina.', canal: 'linkedin', revisaoRef: 'r' }, { arquivo: arquivos.contatos });
  // Operação que ficou ativa antes do reinício do computador (aberta por último: qualquer gravação acima já a recuperaria).
  operar(dados, 'iniciar', { dono: 'rodada-antiga' });
  _dependencias.bootMs = () => Date.now() + 3_600_000;
  const chamadas = [];
  const integrarLote = async dono => { chamadas.push(dono); return { acao: 'encerrado_antigo', observacoes: 14, runId: 'r' }; };
  const r = await prepararRodada({ dirDados: dados, dono: 'rodada-nova', linkedinHabilitado: true, integrarLote, controleNavegador: controle, arquivos });
  assert.deepEqual(chamadas, ['rodada-nova']);
  assert.deepEqual(r.resolvidosSozinhos, ['Uma rodada anterior que tinha ficado aberta foi encerrada', 'Um grupo antigo de 14 vaga(s) do LinkedIn, sem leitura, foi encerrado com registro']);
  assert.equal(r.comErro, 1);
  assert.deepEqual(r.precisaDeVoce, ['Autorizar uma mensagem para Marina, sobre a vaga Product Designer · Acme', 'Reabrir 2 rascunho(s) que se perderam quando o computador reiniciou']);
  assert.equal(r.informacoes.filaNotion.pendentes, 1);
  // E o fechamento junta tudo, sem pedir nada a a pessoa candidata além do que é dele.
  const f = fecharRodada({ mapeadas: 30, aplicadas: 5, arquivos });
  assert.match(f.texto, /Mapeadas \| 30 \|/); assert.match(f.texto, /Aplicadas \| 5 \|/); assert.match(f.texto, /Com erro \| 1 \|/);
  assert.match(f.texto, /Precisa de você\n- Autorizar uma mensagem para Marina/);
  assert.ok(!/[—–]/.test(f.texto));
  // Segunda preparação não duplica nada.
  const r2 = await prepararRodada({ dirDados: dados, dono: 'rodada-nova', linkedinHabilitado: true, integrarLote, controleNavegador: controle, arquivos });
  assert.equal(r2.comErro, 1); assert.equal(r2.precisaDeVoce.length, 2);
});

test('lote do LinkedIn que pede o sim da pessoa vira pedido; falha da integração vira erro, não trava', async t => {
  const { dados, arquivos } = pasta(t);
  let r = await prepararRodada({ dirDados: dados, dono: 'd', linkedinHabilitado: true, arquivos, integrarLote: async () => ({ acao: 'captura_parcial', runId: 'r1', requerAceite: true }) });
  assert.deepEqual(r.precisaDeVoce, ['Dizer se quer retomar a busca no LinkedIn que ficou pela metade']);
  r = await prepararRodada({ dirDados: dados, dono: 'd', linkedinHabilitado: true, arquivos, integrarLote: async () => { throw new Error('CONTROLE_INVALIDO'); } });
  assert.equal(r.comErro, 1); assert.deepEqual(r.precisaDeVoce, []);
  r = await prepararRodada({ dirDados: dados, dono: 'd', linkedinHabilitado: false, arquivos });
  assert.equal(r.comErro, 0);
});

test('nome de vaga com travessão não derruba o fechamento: o texto sai com vírgula', t => {
  const { arquivos } = pasta(t);
  registrar({ codigo: 'RESPOSTA_PESSOAL', vaga: 'Product Designer – Nubank' }, { arquivo: arquivos.ocorrencias });
  const f = fecharRodada({ mapeadas: 1, aplicadas: 0, arquivos });
  assert.match(f.texto, /- Responder uma pergunta pessoal da vaga Product Designer, Nubank/);
  assert.ok(!/[—–]/.test(f.texto));
});

test('o que se resolveu durante a rodada sai da conta no fechamento: fila gravada e mensagem já tratada', async t => {
  const { dados, arquivos } = pasta(t);
  enfileirar([{ idExterno: 'a:1', titulo: 'PD', empresa: 'A', link: 'https://x.test/1' }], { arquivo: arquivos.fila, espelho: path.join(dados, 'notion.json') });
  for (let i = 0; i < 3; i++) registrarFalha('a:1', 'limite', { arquivo: arquivos.fila });
  const r = await prepararRodada({ dirDados: dados, dono: 'd', arquivos });
  assert.equal(r.comErro, 1);
  marcarGravado('a:1', 'pagina-1', { arquivo: arquivos.fila, espelho: path.join(dados, 'notion.json'), provaRef: 'a:1|pagina-1|fixture:releitura' });
  const f = fecharRodada({ mapeadas: 4, aplicadas: 1, arquivos });
  assert.equal(f.comErro, 0); assert.match(f.texto, /^Rodada concluída ✅/); assert.equal(f.resolvidasSozinhas, 1);
});
