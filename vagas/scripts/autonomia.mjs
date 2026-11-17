#!/usr/bin/env node
// Rodada autônoma (spec 016).
//   preparar --dono ID     antes da rodada: resolve o que dá sozinho e devolve o que sobrou
//   registrar --arquivo F  registra uma ocorrência: {codigo, vaga?, detalhe?, resolvida?, resolucao?}
//   resumo --arquivo F     fecha a rodada: {mapeadas, aplicadas}; imprime os quatro números e a lista
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DIR_DADOS, RAIZ } from '../src/config.js';
import { configuracaoFeed } from '../src/linkedin-feed-config.js';
import { prepararRodada, fecharRodada } from '../src/autonomia.js';
import { registrar } from '../src/ocorrencias.js';
import { lerJsonSeguro } from '../src/persistencia.js';

export async function main(argv = process.argv.slice(2), saida = t => process.stdout.write(`${t}\n`)) {
  const [acao, ...resto] = argv, o = {};
  for (let i = 0; i < resto.length; i += 2) {
    if (!['--dono', '--arquivo'].includes(resto[i]) || !resto[i + 1]) throw new Error('ARGUMENTO_INVALIDO');
    o[resto[i]] = resto[i + 1];
  }
  const entrada = () => lerJsonSeguro(resolve(o['--arquivo'] || (() => { throw new Error('ARQUIVO_OBRIGATORIO'); })()));
  if (acao === 'preparar') {
    if (!o['--dono']) throw new Error('DONO_OBRIGATORIO');
    const feedScript = join(RAIZ, 'scripts/linkedin-feed.mjs');
    const habilitado = existsSync(feedScript) && configuracaoFeed().habilitado === true;
    const integrarLote = habilitado ? async dono => (await import(pathToFileURL(feedScript).href)).main(['integrar-pendente', '--dono', dono], { saida: () => {} }) : null;
    const r = await prepararRodada({ dirDados: DIR_DADOS, dono: o['--dono'], linkedinHabilitado: habilitado, integrarLote, controleNavegador: null });
    saida(JSON.stringify(r, null, 2)); return r;
  }
  if (acao === 'registrar') { const n = registrar(entrada()); saida(JSON.stringify({ ok: true, ocorrencias: n })); return n; }
  if (acao === 'resumo') {
    const { mapeadas, aplicadas } = entrada();
    const r = fecharRodada({ mapeadas, aplicadas });
    saida(r.texto); return r;
  }
  throw new Error('USO: autonomia.mjs <preparar --dono ID | registrar --arquivo F | resumo --arquivo F>');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(e => { process.stderr.write(`${JSON.stringify({ ok: false, erro: e.message })}\n`); process.exitCode = 1; });
}
