// O quadro no navegador: as vagas por fase, arrastar o card muda a fase.
//
//   npm run quadro                     # abre http://localhost:4182
//   npm run quadro -- --sem-navegador  # so sobe o servidor
//
// Servidor local minimo, Node puro, so em 127.0.0.1. Ele le o cache da rodada
// (hidratado com as regras de hoje) e o quadro (estado e historico), e grava
// SO o status, por src/quadro.js, que nunca apaga nada.
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { RAIZ, perfil } from '../src/config.js';
import * as cache from '../src/cache.js';
import * as quadro from '../src/quadro.js';
import { hidratar } from '../src/hidratar.js';
import { janela, ROTULO, idadeEmDias } from '../src/frescor.js';
import { resolver as resolverSalario, formatar as formatarSalario } from '../src/salario.js';

const PORTA = Number(process.env.QUADRO_PORTA || 4182);
const DIR_REPO = join(RAIZ, '..');

function metadados(v) {
  const nivel = v.senioridade && v.senioridade !== 'sem_rotulo' ? v.senioridade : null;
  return {
    logo: v.logo || v.logoUrl || v.empresaLogo || null,
    localizacao: v.localizacao || [v.cidade, v.estado, v.pais].filter(Boolean).join(', ') || null,
    modelo: v.modelo || (v.remoto === true ? 'Remoto' : null),
    senioridade: nivel ? ({senior:'Sênior',pleno:'Pleno',junior:'Júnior'}[nivel] || nivel) : null,
  };
}

// Apenas projeta dados já existentes. Não deriva ações, datas de envio ou currículo.
function detalhes(v, q = {}) {
  const campos = ['pendencia', 'publicadaEm', 'prazo', 'aplicadaEm', 'resultado', 'curriculo', 'curriculoCaminho', 'itensCompatibilidade'];
  return Object.fromEntries(campos.map(campo => [campo, q[campo] ?? v[campo] ?? null]));
}

/** As vagas como o quadro mostra: as do cache, hidratadas, mais as que so o quadro lembra. */
function listar() {
  const dados = quadro.carregar();
  const { ativas } = hidratar(Object.values(cache.carregar().vagas));
  const porId = new Map();
  for (const v of ativas) {
    const q = dados.vagas[v.idExterno];
    if (!q) continue; // so entra no quadro pela rodada (quadro.registrar)
    const sal = v.salario ?? resolverSalario(v);
    porId.set(v.idExterno, {
      ...metadados(v), ...detalhes(v, q), id: v.idExterno, status: q.status, titulo: v.titulo, empresa: v.empresa, link: v.link, fonte: v.fonte,
      compatibilidade: v.compatibilidade, lida: v.lida === true, resumo: v.resumo || null, gaps: v.gaps || null,
      salario: formatarSalario(sal), idadeDias: idadeEmDias(v), janela: ROTULO[janela(v)] || null,
      historico: q.historico || [], noCache: true,
    });
  }
  // O que saiu do cache continua no quadro, com o retrato que tinha.
  for (const [id, q] of Object.entries(dados.vagas)) {
    if (porId.has(id)) continue;
    porId.set(id, {
      ...metadados(q), ...detalhes(q), id, status: q.status, titulo: q.titulo, empresa: q.empresa, link: q.url, fonte: q.fonte || null,
      compatibilidade: q.compatibilidade ?? null, lida: null, resumo: q.resumo || null, gaps: q.gaps || null,
      salario: q.salarioTexto || '—', idadeDias: q.publicadaEm ? Math.round((Date.now() - new Date(q.publicadaEm)) / 86400000) : null, janela: null,
      historico: q.historico || [], noCache: false,
    });
  }
  const vagas = [...porId.values()].sort((a, b) => (b.compatibilidade ?? -1) - (a.compatibilidade ?? -1));
  return { vagas, status: quadro.STATUS, contagem: quadro.contarPorStatus(dados), sincronizadoEm: dados.sincronizadoEm, cargoAlvo: perfil.cargo_alvo || null };
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const servidor = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORTA}`);
  const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': TIPOS['.html'] }); res.end(readFileSync(join(DIR_REPO, 'quadro', 'index.html'))); return;
  }
  if (req.method === 'GET' && url.pathname === '/api/vagas') return json(200, listar());
  if (req.method === 'POST' && url.pathname === '/api/status') {
    const host = req.headers.host;
    const origem = req.headers.origin;
    // O navegador envia Origin; o proxy Node interno envia JSON sem Origin.
    // Host também é restrito para não confiar em um par Host/Origin arbitrário.
    if (![`localhost:${PORTA}`, `127.0.0.1:${PORTA}`].includes(host) ||
        (origem !== undefined && origem !== `http://${host}`)) {
      return json(403, { erro: 'Origem da solicitação inválida.' });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      return json(415, { erro: 'Envie a solicitação como application/json.' });
    }
    let corpo = '';
    req.on('data', (c) => { corpo += c; if (corpo.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const { id, status } = JSON.parse(corpo);
        if (typeof id !== 'string' || typeof status !== 'string') throw new Error('id e status precisam ser texto');
        quadro.mover(id, status, { por: 'pessoa' });
        json(200, { ok: true, ...listar() });
      } catch (e) { json(422, { erro: String(e.message || e) }); }
    });
    return;
  }
  res.writeHead(404); res.end();
});

servidor.listen(PORTA, '127.0.0.1', () => {
  const endereco = `http://localhost:${PORTA}`;
  console.log(`\nQuadro em ${endereco}\nArrastar o card grava em data/quadro.json. Ctrl+C fecha.\n`);
  if (process.argv.includes('--sem-navegador')) return;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try { spawn(cmd, [endereco], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref(); } catch { /* abre a mao */ }
});
