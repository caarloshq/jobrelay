import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = fs.mkdtempSync(path.join(root, 'local/data/fila-operacional-'));
const dados = path.join(base, 'vagas/data');
fs.mkdirSync(dados, { recursive: true });
process.env.VAGAS_DIR_DADOS = dados;
process.env.VAGAS_SEM_ENV = '1';
const fila = await import('../src/fila-notion.js');
const arquivo = await import('../src/arquivo.js');
const fonte = await import('../src/fonte-estado.js');
const { gravarJsonAtomico, lerJsonSeguro } = await import('../src/persistencia.js');
const { main: cliFila } = await import('../scripts/fila-notion.mjs');
beforeEach(() => { for (const nome of fs.readdirSync(dados)) fs.rmSync(path.join(dados, nome), { recursive: true, force: true }); });
after(() => fs.rmSync(base, { recursive: true, force: true }));
const vaga = (id = 'ats:primeira') => ({ idExterno: id, titulo: 'Cargo fictício', empresa: 'Empresa fictícia', link: 'https://example.invalid/oferta?job_id=1', compatibilidade: 80 });
const ler = nome => lerJsonSeguro(path.join(dados, nome));
for (const modo of ['local', 'notion']) test(`${modo}: gravação local e releitura do destino sem trocar a seleção`, () => {
  fonte.selecionar(modo, modo === 'notion' ? 'database-ficticia' : null);
  const opcao = fs.readFileSync(path.join(dados, 'fonte-estado.json'), 'utf8');
  fila.enfileirar([vaga()]);
  assert.equal(fila.resumoFila().pendentes, 1);
  const v = ler('quadro.json').vagas['ats:primeira'];
  assert.equal(v.status, 'Avaliar'); assert.equal(v.pendenteNotion, true); assert.equal(v.historico.length, 1);
  assert.equal(arquivo.carregarOperacional().vagas['ats:primeira'].titulo, 'Cargo fictício');
  if (modo === 'notion') assert.throws(() => arquivo.carregar(), /ESTADO_NOTION_AUSENTE/);
  assert.throws(() => fila.marcarGravado('ats:primeira', 'pagina-1'), /RELEITURA_NOTION_OBRIGATORIA/);
  assert.throws(() => fila.marcarGravado('ats:primeira', 'pagina-1', { provaRef: 'ats:outra|pagina-1|fixture' }), /RELEITURA_NOTION_OBRIGATORIA/);
  cliFila(['gravado', '--id', 'ats:primeira', '--pagina', 'pagina-1', '--prova', 'ats:primeira|pagina-1|fixture:releitura'], () => {});
  assert.equal(fila.resumoFila().pendentes, 0); assert.equal(ler('quadro.json').vagas['ats:primeira'].paginaId, 'pagina-1');
  assert.equal(fs.readFileSync(path.join(dados, 'fonte-estado.json'), 'utf8'), opcao);
});
test('terminal, histórico e alias persistem sem duplicar ou reabrir', () => {
  const historico = [{ em: '2026-11-01T12:00:00.000Z', de: 'Avaliar', para: 'Aplicado por IA', por: 'fixture' }];
  gravarJsonAtomico(path.join(dados, 'quadro.json'), { versao: 2, vagas: { 'ats:recebida': { status: 'Aplicado por IA', titulo: 'Cargo anterior', url: vaga().link, historico, idsAlternativos: ['linkedin:alias'] } } });
  arquivo.mesclar([{ ...vaga('linkedin:alias'), url: vaga().link, status: 'Avaliar' }]);
  const d = ler('quadro.json'); assert.deepEqual(Object.keys(d.vagas), ['ats:recebida']);
  assert.equal(d.vagas['ats:recebida'].status, 'Aplicado por IA'); assert.deepEqual(d.vagas['ats:recebida'].historico, historico);
  assert.equal(fila.enfileirar([vaga('linkedin:alias')]).novos, 0); assert.equal(fila.resumoFila().pendentes, 0);
  assert.equal(fs.readdirSync(path.join(dados, 'backups')).length, 1);
});
test('terminal conhecido no snapshot impede reoferta sem liberar preflight Notion', () => {
  fonte.selecionar('notion', 'database-ficticia');
  gravarJsonAtomico(path.join(dados, 'notion.json'), { fonte: 'notion', databaseId: 'database-ficticia', vagas: { 'ats:recebida': { status: 'Aplicado por IA', url: vaga().link, idsAlternativos: ['linkedin:alias'] } } });
  assert.equal(fila.enfileirar([vaga('linkedin:alias')]).novos, 0);
  arquivo.mesclar([{ ...vaga('linkedin:alias'), status: 'Avaliar' }]);
  assert.equal(ler('quadro.json').vagas['ats:recebida'].status, 'Aplicado por IA');
  assert.throws(() => arquivo.carregar(), /ESTADO_NOTION_AUSENTE/);
});
test('consulta pública lê 15 modelos e preserva a fonte', () => {
  const p = path.join(root, 'aplicacao/RESPOSTAS.md'); const antes = fs.readFileSync(p, 'utf8');
  const r = spawnSync(process.execPath, [path.join(root, 'vagas/scripts/respostas.mjs'), '--consultar-base'], { encoding: 'utf8', env: { ...process.env, VAGAS_SEM_ENV: '1' } });
  assert.equal(r.status, 0, r.stderr); const consulta = JSON.parse(r.stdout); assert.equal(consulta.total, 15);
  for (const pergunta of consulta.perguntas) assert.match(pergunta.markdown, /Pendente de resposta da pessoa candidata/);
  assert.doesNotMatch(r.stdout, /"aprovada":true/); assert.equal(fs.readFileSync(p, 'utf8'), antes);
});


test('parâmetro de identidade na URL não funde requisições distintas', () => {
  gravarJsonAtomico(path.join(dados, 'quadro.json'), { versao: 2, vagas: { 'ats:antiga': { status: 'Aplicado por IA', url: 'https://example.invalid/careers?gh_jid=1', historico: [] } } });
  const nova = { ...vaga('ats:nova'), link: 'https://example.invalid/careers?gh_jid=2' };
  assert.equal(fila.enfileirar([nova]).novos, 1);
  assert.deepEqual(Object.keys(ler('quadro.json').vagas).sort(), ['ats:antiga', 'ats:nova']);
});


test('terminal local prevalece sem reconciliar snapshot terminal divergente', () => {
  const historico = [{ em: '2026-11-16T12:00:00Z', para: 'Aplicado por IA' }];
  gravarJsonAtomico(path.join(dados, 'quadro.json'), { versao: 2, vagas: { a: { status: 'Aplicado por IA', atualizadoEm: '2026-11-16T12:00:00Z', historico }, b: { status: 'Avaliar' } } });
  gravarJsonAtomico(path.join(dados, 'notion.json'), { vagas: { a: { status: 'Cancelada', atualizadoEm: '2026-11-01T12:00:00Z' }, b: { status: 'Aplicado por IA' } } });
  const r = arquivo.carregarOperacional();
  assert.equal(r.vagas.a.status, 'Aplicado por IA'); assert.deepEqual(r.vagas.a.historico, historico);
  assert.equal(r.conflitosStatus[0].motivo, 'RECONCILIACAO_OBRIGATORIA');
  assert.equal(r.vagas.b.status, 'Aplicado por IA');
});
