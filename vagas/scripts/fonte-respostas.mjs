#!/usr/bin/env node
import { lerFonteRespostas, selecionarFonteRespostas, marcarPendenciaResposta,
  confirmarRespostaSincronizada, estadoSincroniaRespostas } from '../src/fonte-respostas.js';

const args = process.argv.slice(2);
try {
  let resultado;
  if (args.length === 0 || (args.length === 1 && args[0] === '--estado')) {
    resultado = estadoSincroniaRespostas();
  } else if (args[0] === '--fonte' && ['local', 'local_notion'].includes(args[1]) &&
      (args.length === 2 || (args.length === 4 && args[2] === '--pagina'))) {
    resultado = selecionarFonteRespostas(args[1], args[3] || null);
  } else if (args.length === 2 && args[0] === '--pendente') {
    resultado = marcarPendenciaResposta(args[1]);
  } else if (args.length === 2 && args[0] === '--conferida') {
    resultado = confirmarRespostaSincronizada(args[1]);
  } else {
    throw new Error('Uso: npm run fonte:respostas -- [--estado | --fonte local | --fonte local_notion [--pagina URL] | --pendente ID | --conferida ID]');
  }
  console.log(JSON.stringify(resultado, null, 2));
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
}
