// Incidentes 9 e 10 de 16 de Novembro de 2026: captura girando em páginas vazias e posts que pedem comentário.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cartoesDeVaga, postsDoRetrato, classificarPedido, criarFiltroTitulo, ehPostDeVaga, idDaVaga, buscasPadrao, executarRota, novoLedger, trechoAtivo } from '../scripts/lib-captura.mjs';

const palavras = { titulo_aceito: { 'product designer': 20, 'ux designer': 16 }, cargos_da_area: ['designer'], titulo_excluido: ['estagio', 'intern'], cargo_excluido: ['marketing'], nivel_excluido: ['staff'] };
const filtro = criarFiltroTitulo(palavras);

const jobs = `- generic
  - button "Dismiss Product Designer job" [ref=e10]
    - StaticText "Product Designer"
    - StaticText "Acme"
    - StaticText "Brazil"
  - button "Dismiss Marketing Intern job" [ref=e11]
    - StaticText "Marketing Intern"
    - StaticText "Beta"
    - StaticText "Brazil"`;
const post = (extra = '') => `- generic
  - heading "Feed post" [level=2, ref=e1]
  - link "Marina Souza Verified Profile 2nd" [ref=e2]
    - /url: https://www.linkedin.com/in/marina-souza-123?miniProfileUrn=abc
    - generic "Marina Souza Verified Profile 2nd"
  - link "Post de Marina" [ref=e3]
    - /url: https://www.linkedin.com/feed/update/urn:li:activity:7001?trk=x
  - paragraph
    - StaticText "Estamos contratando Product Designer para o time de produto, 100% remoto. ${extra} Quem tiver interesse, comente aqui embaixo que eu chamo no privado e passo os detalhes da vaga."`;

test('cartões de vaga trazem título, empresa e referência', () => {
  const c = cartoesDeVaga(jobs);
  assert.deepEqual(c.map(x => [x.titulo, x.empresa, x.ref]), [['Product Designer', 'Acme', 'e10'], ['Marketing Intern', 'Beta', 'e11']]);
});

test('o filtro de título vem da configuração da instalação', () => {
  assert.equal(filtro('Senior Product Designer'), true);
  assert.equal(filtro('Marketing Intern'), false);
  assert.equal(filtro('Staff Product Designer'), false);
  assert.equal(filtro('Contador'), false);
});

test('post de vaga: autor, perfil limpo, link do post e o pedido de comentário', () => {
  const [p] = postsDoRetrato(post());
  assert.equal(p.autor, 'Marina Souza');
  assert.equal(p.perfil, 'https://www.linkedin.com/in/marina-souza-123');
  assert.equal(p.postLink, 'https://www.linkedin.com/feed/update/urn:li:activity:7001');
  assert.equal(p.pedido, 'comentario');
  assert.equal(ehPostDeVaga(p.texto, filtro), true);
});

test('captura anúncio e links de trabalho sem triar aderência do cargo', () => {
  const texto = 'We are hiring a Data Engineer for our infrastructure team. Apply through the role link today. The position will build reliable systems, collaborate with product teams and improve our data platform for customers.';
  const retrato = `- heading "Feed post" [level=2, ref=e1]\n- link "Ana Silva Profile" [ref=e2]\n  - /url: https://www.linkedin.com/in/ana/\n- link "Post da Ana" [ref=e3]\n  - /url: https://www.linkedin.com/feed/update/urn:li:activity:7002\n- link "Data Engineer role" [ref=e4]\n  - /url: https://jobs.example.com/roles/123?source=linkedin\n- StaticText "${texto}"`;
  const [p] = postsDoRetrato(retrato);
  assert.equal(ehPostDeVaga(p.texto, filtro), true);
  assert.deepEqual(p.linksOferta, ['https://jobs.example.com/roles/123?source=linkedin']);
  assert.equal(p.postLink, 'https://www.linkedin.com/feed/update/urn:li:activity:7002');
});

test('retrato sem endereços ainda traz o autor, e o contato fica só com o nome', () => {
  const [p] = postsDoRetrato(post().split('\n').filter(l => !l.includes('/url:')).join('\n'));
  assert.equal(p.autor, 'Marina Souza'); assert.equal(p.perfil, null); assert.equal(p.postLink, null);
});

test('o que cada post pede', () => {
  assert.equal(classificarPedido('Comente "quero" que eu envio os detalhes'), 'comentario');
  assert.equal(classificarPedido('Interessados, mandem mensagem no inbox'), 'mensagem');
  assert.equal(classificarPedido('Envie seu CV para vagas@empresa.com.br'), 'email');
  assert.equal(classificarPedido('Estamos contratando. Candidate-se pelo link'), 'nenhum');
});

test('identificador da vaga vem do endereço depois do clique', () => {
  assert.equal(idDaVaga('https://www.linkedin.com/jobs/search-results/?currentJobId=4491202040&keywords=x'), '4491202040');
  assert.equal(idDaVaga('https://www.linkedin.com/jobs/view/4491202041/'), '4491202041');
  assert.equal(idDaVaga('https://www.linkedin.com/jobs/'), null);
});

test('as buscas saem dos títulos aceitos', () => {
  const b = buscasPadrao(palavras);
  assert.deepEqual(b.jobs, ['Product Designer', 'Ux Designer']);
  assert.ok(b.postagens.includes('Product Designer contratando'));
});

// ---- laço de uma rota, sem navegador ----

function ambiente({ retratos, buscas = { jobs: ['A', 'B', 'C'], postagens: ['p1', 'p2'] }, relogioPorChamada = 500 }) {
  let t = 1_000_000, jobId = '4491202040'; const chamadas = [], intervalos = [], observacoes = [], esgotadas = [];
  const nav = (...a) => { t += relogioPorChamada; chamadas.push(a.join(' ')); if (a[0] === 'click' && a[1] === '@e11') jobId = '4491202041'; return a[0] === 'get' ? { data: { url: `https://www.linkedin.com/jobs/search-results/?currentJobId=${jobId}` } } : { success: true }; };
  let i = 0;
  const retrato = nome => ({ texto: retratos[Math.min(i++, retratos.length - 1)], caminho: `retrato/${nome}.json` });
  const ledger = novoLedger();
  const base = { filtro, ledger, buscas, nav, retrato, agora: () => t, espera: async ms => { t += ms; }, salvar: () => {},
    registrarIntervalo: d => intervalos.push(d), observar: o => observacoes.push(o), esgotar: d => esgotadas.push(d), maxMs: 3_600_000 };
  const feito = () => intervalos.reduce((a, d) => a + (Date.parse(d.fimEm) - Date.parse(d.inicioEm)) / 1000, 0);
  return { base, chamadas, intervalos, observacoes, esgotadas, ledger, feito };
}

test('buscas vazias não contam tempo e a rota é declarada esgotada', async () => {
  const a = ambiente({ retratos: ['- generic'] });
  const r = await executarRota({ ...a.base, rota: 'jobs', cfg: { meta: 900, origem: 'Jobs' }, feitoNaRota: a.feito });
  assert.equal(r.motivo, 'esgotada');
  assert.equal(a.intervalos.length, 0);
  assert.equal(a.observacoes.length, 0);
  assert.deepEqual(a.esgotadas.map(e => [e.rota, e.buscas]), [['jobs', 3]]);
  assert.ok(a.ledger.stats.jobs.ociosos >= 3);
});

test('trecho com conteúdo novo é registrado; trechos parados depois dele, não', async () => {
  const a = ambiente({ retratos: [jobs], buscas: { jobs: ['A'], postagens: [] } });
  const r = await executarRota({ ...a.base, rota: 'jobs', cfg: { meta: 900, origem: 'Jobs' }, feitoNaRota: a.feito });
  assert.equal(r.motivo, 'esgotada');
  assert.equal(a.observacoes.length, 2);
  assert.deepEqual([a.observacoes[0].cargo, a.observacoes[0].empresa, a.observacoes[0].url], ['Product Designer', 'Acme', 'https://www.linkedin.com/jobs/view/4491202040/']);
  assert.deepEqual(a.observacoes.map(o => o.cargo), ['Product Designer', 'Marketing Intern']);
  assert.equal(a.intervalos.length, 1);
  const seg = (Date.parse(a.intervalos[0].fimEm) - Date.parse(a.intervalos[0].inicioEm)) / 1000;
  assert.ok(seg > 0 && seg <= 55, `trecho de ${seg}s`);
  assert.ok(a.chamadas.some(c => c === 'click @e10'));
  assert.ok(a.chamadas.some(c => c === 'click @e11'), 'captura guarda o link antes da triagem');
});

test('posts: o contato do autor segue na observação e nada é comentado', async () => {
  const a = ambiente({ retratos: [post()], buscas: { jobs: [], postagens: ['p1'] } });
  const r = await executarRota({ ...a.base, rota: 'postagens', cfg: { meta: 720, origem: 'Postagens', url: 'https://www.linkedin.com/feed/' }, feitoNaRota: a.feito });
  assert.ok(['esgotada', 'meta', 'tempo'].includes(r.motivo));
  assert.equal(a.observacoes.length, 1);
  const o = a.observacoes[0];
  assert.deepEqual(o.contato, { nome: 'Marina Souza', perfil: 'https://www.linkedin.com/in/marina-souza-123', postLink: 'https://www.linkedin.com/feed/update/urn:li:activity:7001', pedido: 'comentario' });
  assert.equal(o.url, 'https://www.linkedin.com/feed/update/urn:li:activity:7001');
  for (const c of a.chamadas) assert.ok(!/coment|comment|fill|type|press/i.test(c), `ação proibida: ${c}`);
});

test('a meta cumprida encerra a rota sem declarar esgotamento', async () => {
  const a = ambiente({ retratos: [jobs] });
  const r = await executarRota({ ...a.base, rota: 'jobs', cfg: { meta: 900, origem: 'Jobs' }, feitoNaRota: () => 900 });
  assert.equal(r.motivo, 'meta'); assert.equal(a.esgotadas.length, 0);
});

test('só conta como ativo o trecho com algo novo', () => {
  assert.equal(trechoAtivo({ novasVistas: 0, observadas: 0 }), false);
  assert.equal(trechoAtivo({ novasVistas: 2, observadas: 0 }), true);
  assert.equal(trechoAtivo({ novasVistas: 0, observadas: 1 }), true);
});


test('o bloco guarda links depois do texto e conserva ofertas distintas por query', () => {
  const snapshot = `- heading "Feed post" [level=2]
- link "Post" [ref=e1]
  - /url: https://www.linkedin.com/feed/update/urn:li:activity:987
- StaticText "We are hiring. Apply through the links below."
- link "Oferta A" [ref=e2]
  - /url: https://jobs.example.com/job?id=123
- link "Oferta B" [ref=e3]
  - /url: https://jobs.example.com/job?id=456
- heading "Feed post" [level=2]
- StaticText "A different post, without links."`;
  const posts = postsDoRetrato(snapshot);
  assert.equal(posts.length, 2);
  assert.equal(posts[0].postLink, 'https://www.linkedin.com/feed/update/urn:li:activity:987');
  assert.deepEqual(posts[0].linksOferta, ['https://jobs.example.com/job?id=123', 'https://jobs.example.com/job?id=456']);
  assert.deepEqual(posts[1].linksOferta, []);
});


test('não funde requisições cujo identificador está na query da URL', () => {
  const texto = 'We are hiring. Apply through one of the links below for two distinct positions in our product organisation, working with engineering and design teams to improve our customer platform.';
  const snapshot = `- heading "Feed post" [level=2]
- link "Oferta A" [ref=e1]
  - /url: https://jobs.example.com/job?id=123
- link "Oferta B" [ref=e2]
  - /url: https://jobs.example.com/job?id=456
- StaticText "${texto}"`;
  assert.deepEqual(postsDoRetrato(snapshot)[0].linksOferta, ['https://jobs.example.com/job?id=123', 'https://jobs.example.com/job?id=456']);
});
