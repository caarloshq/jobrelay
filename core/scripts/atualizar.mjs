import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atualizarAutomaticamente, lerConfirmacao } from '../src/atualizacao.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const resultado = await atualizarAutomaticamente({ raiz, confirmacao: lerConfirmacao(process.argv.slice(2)) });
console.log(JSON.stringify(resultado));
if (resultado.status === 'bloqueado') process.exitCode = 2;
if (resultado.status === 'aguardando_confirmacao') process.exitCode = 3;
