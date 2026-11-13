import { evidenciaModalidade } from '../modalidade.js';
// Hidden Jobs — RSS estático (GitHub Pages) de vagas lidas direto da página de
// carreira de cada empresa, principalmente na Europa, mais um repasse do UX Jobs.
// Adicionado em 12/11/2026, por pedido explícito nesta instalação: https://sarabrunettini.github.io/hiddenjobs/
//
// O feed não tem API: são arquivos .xml estáticos, um por categoria. Usamos as
// duas que cobrem o escopo do perfil (produto e marca): product-ux e brand.
// Cada <item> traz so uma linha de descricao fixa, sem o anuncio real:
//   "Empresa · Local · Categoria · Full-time · On-site/Remote/Hybrid"
// O ultimo campo e o modo de trabalho; preservamos o modo para o filtro posterior, antes de
// qualquer decisão de compatibilidade do perfil.
//
// E fonte internacional: a maioria das empresas e europeia, e "Remote" aqui
// quase nunca diz Brasil. Reaproveitamos o mesmo juiz de elegibilidade que a
// camada internacional (gringas/intl.js) usa: campo estruturado manda, e so
// na ausencia dele o texto decide. Sem descricao real, a maioria cai em
// "elegibilidade nao declarada" e entra marcada — a leitura humana resolve.
import { buscar as buscarPadrao, limparHtml, dormir, novoContador, normalizarTexto, casaTermo } from '../util.js';
import { palavras } from '../config.js';
import { avaliarElegibilidade } from './intl.js';

const BASE = 'https://sarabrunettini.github.io/hiddenjobs/';
export const NOME = 'Hidden Jobs';
export const FEEDS = ['feeds/product-ux.xml', 'feeds/brand.xml'];

/** Parser de RSS suficiente para este feed. Sem dependencia externa. */
export function lerRss(xml) {
  if (!xml) return [];
  const itens = [];
  for (const bloco of xml.split(/<item\b/).slice(1)) {
    const pega = (tag) => {
      const m = bloco.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      if (!m) return null;
      return m[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
    };
    const link = pega('link');
    if (!link) continue;
    itens.push({
      titulo: limparHtml(pega('title')),
      link,
      descricaoCrua: limparHtml(pega('description')),
      data: pega('pubDate'),
      guid: pega('guid') || link,
    });
  }
  return itens;
}

/**
 * "Carwow · London · Product & UX · Full-time · On-site" -> partes nomeadas.
 * O numero de campos e fixo nesta fonte; um item fora do padrao fica com
 * `modo` null e nao entra (nunca presumimos remoto por falta de campo aqui,
 * o contrario da regra geral — a fonte e europeia o bastante para isso importar).
 */
export function lerCabecalho(descricaoCrua) {
  const partes = String(descricaoCrua || '').split('·').map((s) => s.trim()).filter(Boolean);
  const [empresa, local, categoria, contrato, modo] = partes;
  return { empresa: empresa || null, local: local || null, categoria: categoria || null, contrato: contrato || null, modo: modo || null };
}

function interessa(titulo) {
  const t = normalizarTexto(titulo);
  if (!t) return false;
  if (palavras.titulo_excluido.some((x) => casaTermo(t, x))) return false;
  return Object.keys(palavras.titulo_aceito).some((k) => t.includes(normalizarTexto(k)));
}

export async function coletar({ buscar = buscarPadrao } = {}) {
  const c = novoContador(NOME);
  const vistos = new Map();

  for (const feed of FEEDS) {
    c.consultadas++;
    let xml = null;
    try {
      xml = await buscar(BASE + feed, { texto: true, tentativas: 2, timeoutMs: 20000 });
    } catch {
      c.falhas++;
      continue;
    }
    const itens = lerRss(xml);
    c.brutas += itens.length;

    for (const i of itens) {
      if (vistos.has(i.guid) || !interessa(i.titulo)) continue;
      const { empresa, local, contrato, modo } = lerCabecalho(i.descricaoCrua);
      // Modalidade é preservada; compatibilidade pertence ao filtro posterior.

      const eleg = avaliarElegibilidade({ restricoes: local ? [local] : [], descricao: '' });
      if (!eleg.entra) continue;

      const data = i.data ? new Date(i.data) : null;
      vistos.set(i.guid, evidenciaModalidade({
        idExterno: `hiddenjobs:${i.guid.split('/').filter(Boolean).pop() || i.guid}`,
        fonte: NOME,
        camada: 'API',
        titulo: i.titulo.replace(/\s*—\s*[^—]+$/, '').trim() || i.titulo, // "Cargo — Empresa" -> so o cargo
        empresa: empresa || i.titulo.split('—').pop()?.trim() || null,
        descricao: null,
        descricaoPendente: true,
        link: i.link,
        cidade: null,
        estado: null,
        pais: local || null,
        modelo: null,
        remoto: null,
        contrato: contrato || null,
        publicadaEm: data && !Number.isNaN(data.getTime()) ? data.toISOString() : null,
        atualizadaEm: null,
        prazo: null,
        salarioBruto: null,
        statusFonte: 'aberta',
        validada: true,
        elegibilidadeLatam: eleg.latam,
        elegibilidadeMotivo: eleg.motivo,
      }, { campos:[{campo:'modo',valor:modo}], localizacao:local }));
    }
    await dormir(300);
  }

  // O feed so tem a linha-cabecalho; a descricao real mora na pagina de
  // carreira de cada empresa (ATS variado: Ashby, Greenhouse, Workday, etc).
  // Buscamos uma vez por vaga, best-effort — se falhar, fica pendente e a
  // leitura humana confere na pagina oficial antes de decidir.
  for (const v of vistos.values()) {
    try {
      const html = await buscar(v.link, { texto: true, tentativas: 1, timeoutMs: 20000 });
      const semScript = String(html || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
      const txt = limparHtml(semScript).trim();
      if (txt.length > 200) {
        v.descricao = txt;
        v.descricaoPendente = false;
      }
    } catch { c.falhas++; }
    await dormir(400);
  }

  return { vagas: [...vistos.values()].map(v=>evidenciaModalidade(v)), contador: c };
}
