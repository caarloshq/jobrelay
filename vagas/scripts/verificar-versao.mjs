// Execução consultiva: não altera o repositório e não bloqueia o primeiro uso.
// Imprime primeiro a versão do produto (spec 015) e depois a comparação de commits Git.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verificarVersaoGit, formatarVersaoGit } from '../src/versao-git.js';
import { mensagemVersao, lerVersaoInstalada, consultarUltimaRelease, PERGUNTA_ATUALIZAR } from '../src/versao-produto.js';

const padrao = fileURLToPath(new URL('..', import.meta.url));

export async function main({ cwd = padrao, fetch, saida = console.log, verificarGit = verificarVersaoGit } = {}) {
  const local = lerVersaoInstalada(cwd);
  const release = await consultarUltimaRelease({ fetch });
  const msg = mensagemVersao({ instalada: local.versao, destino: release.ok ? release.versao : null, adaptado: local.adaptado, registrada: local.registrada });
  saida(msg.texto);
  if (['atualizar', 'atualizar_adaptado'].includes(msg.estado)) saida(PERGUNTA_ATUALIZAR);
  saida(formatarVersaoGit(await verificarGit({ cwd })));
  return msg;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
