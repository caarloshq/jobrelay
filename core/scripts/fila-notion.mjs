#!/usr/bin/env node
// Fila de gravação pendente no Notion. O agente lê os pendentes, cria as páginas pelo MCP e marca cada item.
//   status | pendentes [--limite N] | gravado --id ID --pagina PAGINA --prova ID|PAGINA|REFERENCIA | falhou --id ID --motivo TEXTO | compactar
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { pendentes, marcarGravado, registrarFalha, resumoFila, compactar } from '../src/fila-notion.js';

export function main(argv = process.argv.slice(2), saida = valor => process.stdout.write(`${JSON.stringify(valor, null, 2)}\n`)) {
  const [acao = 'status', ...resto] = argv;
  const o = {};
  for (let i = 0; i < resto.length; i += 2) {
    if (!['--id', '--pagina', '--motivo', '--limite', '--prova'].includes(resto[i]) || resto[i + 1] === undefined) throw new Error('ARGUMENTO_INVALIDO');
    o[resto[i]] = resto[i + 1];
  }
  const r = acao === 'status' ? resumoFila()
    : acao === 'pendentes' ? pendentes({ limite: o['--limite'] ? Number(o['--limite']) : 20 })
    : acao === 'gravado' ? marcarGravado(o['--id'], o['--pagina'], { provaRef: o['--prova'] })
    : acao === 'falhou' ? registrarFalha(o['--id'], o['--motivo'])
    : acao === 'compactar' ? compactar()
    : (() => { throw new Error('ACAO_DESCONHECIDA'); })();
  saida(r);
  return r;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main(); } catch (e) { process.stderr.write(`${JSON.stringify({ ok: false, erro: e.message })}\n`); process.exitCode = 1; }
}
