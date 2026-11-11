import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { executarNavegador } from '../src/navegador.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  let args = process.argv.slice(2);
  if (args[0] === '--stdin-json') {
    if (args.length !== 1) throw new Error('--stdin-json recebe somente um array JSON pela entrada padrão.');
    args = JSON.parse(fs.readFileSync(0, 'utf8'));
  }
  const resultado = await executarNavegador(args, { raiz });
  if ('codigo' in resultado) process.exitCode = resultado.codigo;
  if (resultado.estado || resultado.controle || !('codigo' in resultado)) process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
} catch (erro) {
  process.stderr.write(`Navegador do JobRelay: ${erro instanceof SyntaxError ? 'JSON de entrada inválido.' : erro.message}\n`);
  process.exitCode = 1;
}
