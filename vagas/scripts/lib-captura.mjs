// Captura assistida do LinkedIn (spec 016): leitores dos retratos de tela e o laço de uma rota.
// Promovido de `data/rodada-2026-11-16/feed/lib-captura.mjs` e `capturar-janela.mjs`.
// Nada aqui abre navegador: quem chama entrega `nav`, `retrato` e os registradores (testável sem rede).
import { createHash } from 'node:crypto';
import { normalizarContato } from '../src/contatos-posts.js';

const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const sha = t => createHash('sha1').update(t).digest('hex').slice(0, 12);

/** Cartões de vaga do retrato da busca de Jobs: título, empresa, local e referência do elemento. */
export function cartoesDeVaga(snapshot) {
  const L = snapshot.split('\n'); const out = [];
  for (let i = 0; i < L.length; i++) {
    const m = L[i].match(/^(\s*)- button "(.*?)" \[ref=(e\d+)\]/);
    if (!m || !/Dismiss .* job/.test(m[2])) continue;
    const ind = m[1].length; const textos = [];
    for (let j = i + 1; j < L.length; j++) {
      const ind2 = (L[j].match(/^(\s*)/) || ['', ''])[1].length;
      if (L[j].trim() && ind2 <= ind) break;
      const t = L[j].match(/StaticText "(.*)"/);
      if (t && t[1].trim() && t[1].trim() !== '·') textos.push(t[1].trim());
    }
    const dm = m[2].match(/Dismiss (.+?) job/); const titulo = dm ? dm[1].trim() : (textos[0] || null);
    if (!titulo) continue;
    const resto = textos.filter(t => t !== titulo && !t.startsWith(titulo.slice(0, 25)));
    out.push({ ref: m[3], titulo, empresa: resto[0] || null, local: resto[1] || null, label: m[2], easy: /Easy Apply/.test(m[2] + textos.join(' ')) });
  }
  return out;
}

/** Filtro de título gerado da própria configuração da instalação, sem lista fixa de profissão. */
export function criarFiltroTitulo(palavras = {}) {
  const aceitos = [...Object.keys(palavras.titulo_aceito || {}), ...(palavras.cargos_da_area || [])].map(semAcento).filter(Boolean);
  const excluidos = [...(palavras.titulo_excluido || []), ...(palavras.cargo_excluido || []), ...(palavras.nivel_excluido || [])].map(semAcento).filter(Boolean);
  const dentro = (texto, lista) => lista.some(t => semAcento(texto).includes(t));
  const filtro = titulo => !!titulo && dentro(titulo, aceitos) && !dentro(titulo, excluidos);
  filtro.aceitos = aceitos;
  return filtro;
}

/** Quem pede o quê: comentário, mensagem ou e-mail. Comentário nunca é feito, só registrado como pedido. */
export function classificarPedido(texto) {
  const t = semAcento(texto);
  if (/\b(comente|comenta|comentem|comment|comenta aqui|comment below|drop a comment|interested in the comments)\b/.test(t) || /\bcomente\b.{0,30}\b(interesse|eu quero|quero)\b/.test(t)) return 'comentario';
  if (/\b(e-?mail|envie (seu )?(cv|curriculo|portfolio)|send (your )?(cv|resume)|[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})\b/.test(t)) return 'email';
  if (/\b(mensagem|inbox|dm\b|direct|chama no|chame no|message me|dm me|fale comigo|me chama)\b/.test(t)) return 'mensagem';
  return 'nenhum';
}

const LINHA_URL = /^\s*- \/url:\s*(\S+)/;
const urlDe = (L, i, ind) => {
  for (let j = i + 1; j < Math.min(L.length, i + 6); j++) {
    const ind2 = (L[j].match(/^(\s*)/) || ['', ''])[1].length;
    if (L[j].trim() && ind2 <= ind) break;
    const u = L[j].match(LINHA_URL);
    if (u) return u[1];
  }
  const inline = L[i].match(/(?:href|url)="([^"]+)"/);
  return inline ? inline[1] : null;
};

/**
 * Posts do retrato do feed ou da busca de postagens: autor, perfil, link do post e o que ele pede.
 * Os endereços só aparecem quando o retrato foi tirado com a opção de URLs (`snapshot -u`).
 * Sem eles, o contato fica só com o nome, e o agente abre o perfil pelo post.
 */
export function postsDoRetrato(snapshot) {
  const L = snapshot.split('\n'); const posts = []; let atual = null;
  const novo = () => ({ autor: null, perfil: null, postLink: null, linksOferta: [], textos: [] });
  const publicar = () => {
    if (!atual?.textos.length) return;
    const { textos, ...dados } = atual;
    const texto = textos.join(' ').replace(/\s+/g, ' ').trim();
    if (texto) posts.push({ ...dados, texto, pedido: classificarPedido(texto) });
  };
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    if (/heading "Feed post"/.test(l)) { publicar(); atual = novo(); continue; }
    const a = l.match(/^(\s*)- link "([^"]{3,90}?) (?:Verified )?(?:Premium )?(?:Profile|•)[^"]*"/);
    if (a && (!atual || !atual.autor)) {
      atual ||= novo();
      atual.autor = a[2];
      const u = urlDe(L, i, a[1].length);
      if (u && /linkedin\.com\/in\//.test(u)) atual.perfil = u.replace(/[?#].*$/, '');
    }
    const pl = l.match(/^(\s*)- link "[^"]*" \[ref=e\d+\]/);
    if (pl && atual) {
      const u = urlDe(L, i, pl[1].length);
      if (u && /linkedin\.com\/(feed\/update|posts)\//.test(u)) atual.postLink ||= u.replace(/[?#].*$/, '');
      else if (u && !/linkedin\.com\/in\//.test(u)) {
        let url;
        try { url = new URL(u); } catch { continue; }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
        // A query pode identificar a requisição ou o destino de um redirecionador.
        // Guardar o endereço observado; a triagem decide equivalências depois.
        if (!atual.linksOferta.includes(u)) atual.linksOferta.push(u);
      }
    }
    const t = l.match(/StaticText "(.*)"/);
    if (t && t[1].trim()) { atual ||= novo(); atual.textos.push(t[1]); }
  }
  publicar();
  return posts;
}

// A captura busca anúncios, não decide a aderência do cargo ou do perfil.
export const ehPostDeVaga = texto => /\b(vagas?|hiring|we(?:'re| are) hiring|job opening|open roles?|career opportunities|apply now|apply here|contrat(?:ando|acao|ar)|oportunidades?|looking for|procura(?:mos|ndo)?|buscamos|estamos buscando|inscri(?:cao|coes|ba-se)|join our team|work with us|recruiting)\b/i.test(semAcento(texto));

export function idDaVaga(url) {
  return (String(url).match(/currentJobId=(\d{8,})/) || String(url).match(/jobs\/view\/(\d{8,})/) || [])[1] || null;
}

export const urlJobs = (kw, pagina = 0, geoId = '106057199') =>
  `https://www.linkedin.com/jobs/search-results/?keywords=${encodeURIComponent(kw)}&origin=JOB_SEARCH_PAGE_JOB_FILTER&geoId=${geoId}&distance=25.0&f_TPR=r604800${pagina ? `&start=${pagina * 25}` : ''}`;
export const urlPosts = kw => `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(kw)}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D&datePosted=%5B%22past-week%22%5D`;
export const URL_FEED = 'https://www.linkedin.com/feed/';
export const URL_FEED_FORYOU = 'https://www.linkedin.com/feed/foryou/';

/** Buscas derivadas da configuração da instalação: os títulos aceitos, e a combinação deles com palavras de vaga. */
export function buscasPadrao(palavras = {}, { maximoVagas = 12 } = {}) {
  const titulo = t => t.replace(/\b\w/g, c => c.toUpperCase());
  const base = [...new Set(Object.keys(palavras.titulo_aceito || {}).map(titulo))].slice(0, maximoVagas);
  const sufixos = ['vaga', 'contratando', 'hiring', 'oportunidade remota', 'vaga sênior', 'vaga pleno'];
  return { jobs: base, postagens: base.flatMap(t => sufixos.map(s => `${t} ${s}`)) };
}

export const ROTAS_PADRAO = Object.freeze({
  jobs: { meta: 900, origem: 'Jobs; busca assistida' },
  postagens: { meta: 720, origem: 'Postagens; busca assistida, última semana' },
  feed: { meta: 180, origem: 'Feed normal LinkedIn' },
});

export const novoLedger = () => ({ vistas: {}, posts: {}, n: 0, kw: {}, pagina: 0, vazias: 0, aberta: null, esgotada: {}, stats: {
  jobs: { vistas: 0, observadas: 0, trechos: 0, ociosos: 0 }, postagens: { vistas: 0, observadas: 0, trechos: 0, ociosos: 0 }, feed: { vistas: 0, observadas: 0, trechos: 0, ociosos: 0 } } });

/** Tempo parado não conta: só trecho que viu conteúdo novo ou registrou observação vira intervalo. */
export const trechoAtivo = ({ novasVistas, observadas }) => novasVistas > 0 || observadas > 0;

const PAGINAS_POR_BUSCA = 6;

/**
 * Roda uma rota por até `maxMs`. Cada trecho tem no máximo `trechoMaxS` segundos.
 * Devolve `{ motivo }`: 'meta' (cumprida), 'esgotada' (buscas acabaram antes da meta) ou 'tempo' (fim da execução).
 */
export async function executarRota(c) {
  const { rota, cfg, buscas, filtro, ledger, nav, retrato, feitoNaRota, registrarIntervalo, observar, esgotar, salvar,
    agora = () => Date.now(), espera = async () => {}, maxMs, trechoMaxS = 52, folgaS = 6,
    urlFeed = URL_FEED, capturarContato = true } = c;
  const fimExec = agora() + maxMs;
  const abrir = () => {
    const k = ledger.kw[rota] || 0;
    nav('open', rota === 'jobs' ? urlJobs(buscas.jobs[k], ledger.pagina) : rota === 'postagens' ? urlPosts(buscas.postagens[k]) : urlFeed);
  };
  ledger.kw[rota] ||= 0;
  if (ledger.aberta !== rota) { ledger.pagina = 0; ledger.vazias = 0; ledger.aberta = rota; abrir(); salvar(); await espera(5000); }
  let ultimoFim = agora() - 1;
  const total = rota === 'jobs' ? buscas.jobs.length : rota === 'postagens' ? buscas.postagens.length : 0;
  const proximaBusca = async () => {
    ledger.kw[rota]++; ledger.pagina = 0; ledger.vazias = 0;
    if (rota !== 'feed' && ledger.kw[rota] >= total) { ledger.esgotada[rota] = true; return false; }
    abrir(); await espera(4500); return true;
  };
  while (agora() < fimExec) {
    if (ledger.esgotada[rota]) break;
    const restante = cfg.meta - feitoNaRota();
    if (restante <= 0.5) return { motivo: 'meta' };
    const inicioMs = Math.max(ultimoFim, agora() - 1);
    const teto = Math.min(trechoMaxS, restante, (fimExec - agora()) / 1000 + 5);
    const limite = agora() + teto * 1000;
    ledger.n++;
    const antes = retrato(`${rota}-${String(ledger.n).padStart(3, '0')}-antes`, rota !== 'jobs');
    let novasVistas = 0, observadas = 0;
    const registrar = o => { observar(o); observadas++; ledger.stats[rota].observadas++; };
    if (rota === 'jobs') {
      const cartoes = cartoesDeVaga(antes.texto);
      for (const c1 of cartoes) {
        const chave = `${c1.titulo}|${c1.empresa}`;
        if (ledger.vistas[chave]) continue;
        if (agora() > limite - folgaS * 1000) break;
        ledger.vistas[chave] = 1; ledger.stats.jobs.vistas++; novasVistas++;
        try {
          nav('click', `@${c1.ref}`); await espera(900);
          let url = nav('get', 'url')?.data?.url || '';
          let id = idDaVaga(url);
          // Painel que ainda não trocou devolve o endereço do clique anterior: espera uma vez e recusa se repetir.
          if (id && id === ledger.ultimoId) { await espera(900); url = nav('get', 'url')?.data?.url || ''; id = idDaVaga(url); if (id === ledger.ultimoId) { ledger.erros = (ledger.erros || 0) + 1; continue; } }
          if (id) ledger.ultimoId = id;
          const link = id ? `https://www.linkedin.com/jobs/view/${id}/` : url;
          registrar({ cargo: c1.titulo, empresa: c1.empresa, url: link, origem: cfg.origem, linkCandidatura: id ? link : null, referencia: antes.caminho });
        } catch { ledger.erros = (ledger.erros || 0) + 1; }
      }
      const restantes = cartoes.filter(x => !ledger.vistas[`${x.titulo}|${x.empresa}`]).length;
      if (!cartoes.length) await proximaBusca();
      else if (!restantes && agora() < limite - 3000) {
        ledger.pagina++;
        if (ledger.pagina >= PAGINAS_POR_BUSCA) await proximaBusca(); else { abrir(); await espera(4500); }
      }
    } else {
      for (const p of postsDoRetrato(antes.texto)) {
        const h = sha(p.texto.slice(0, 200));
        if (ledger.posts[h]) continue;
        ledger.posts[h] = { autor: p.autor, rota, pedido: p.pedido };
        ledger.stats[rota].vistas++; novasVistas++;
        if (!ehPostDeVaga(p.texto)) continue;
        let contato;
        if (capturarContato) {
          try { contato = p.autor || p.perfil ? normalizarContato({ nome: p.autor, perfil: p.perfil, postLink: p.postLink, pedido: p.pedido }) : undefined; } catch { contato = undefined; }
        }
        registrar({ identidade: `linkedin:post:${h}`, cargo: null, empresa: null, url: p.linksOferta[0] || p.postLink || cfg.url || urlFeed,
          origem: cfg.origem, linkCandidatura: null, postLink: p.postLink, linksOferta: p.linksOferta,
          referencia: antes.caminho, ...(contato ? { contato } : {}) });
      }
      ledger.vazias = novasVistas > 0 ? 0 : ledger.vazias + 1;
      if (ledger.vazias >= 2) {
        if (rota === 'postagens') await proximaBusca();
        else { ledger.reloads = (ledger.reloads || 0) + 1; ledger.vazias = 0; if (ledger.reloads > 25) ledger.esgotada.feed = true; else { nav('open', urlFeed); await espera(4500); } }
      } else { nav('scroll', 'down', '1400'); await espera(1800); }
    }
    const depois = retrato(`${rota}-${String(ledger.n).padStart(3, '0')}-depois`, rota !== 'jobs');
    if (trechoAtivo({ novasVistas, observadas })) {
      const fimMs = Math.min(agora(), inicioMs + teto * 1000);
      const seg = (fimMs - inicioMs) / 1000;
      if (seg > 60) throw new Error(`TRECHO_LONGO: ${seg}`);
      if (seg > 0) {
        registrarIntervalo({ inicioEm: new Date(inicioMs).toISOString(), fimEm: new Date(fimMs).toISOString(), evidenciaInicio: antes.caminho, evidenciaFim: depois.caminho,
          provaRef: `ledger#n=${ledger.n}; ${novasVistas} itens novos, ${observadas} observações` });
        ultimoFim = fimMs; ledger.stats[rota].trechos++;
      }
    } else ledger.stats[rota].ociosos++;
    salvar();
  }
  if (ledger.esgotada[rota]) {
    esgotar({ rota, buscas: Math.max(1, (ledger.kw[rota] || 0)), evidencia: `ledger: ${ledger.kw[rota] || 0} buscas percorridas; ${ledger.stats[rota].ociosos} trechos sem conteúdo novo` });
    return { motivo: 'esgotada' };
  }
  return { motivo: restanteMeta(c) <= 0.5 ? 'meta' : 'tempo' };
}
const restanteMeta = c => c.cfg.meta - c.feitoNaRota();
