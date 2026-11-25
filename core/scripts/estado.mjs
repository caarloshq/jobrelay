// Configuração local (data/fonte-estado.json) e importação de snapshot do
// Notion consultado pelo agente via MCP. Não recebe token e não acessa a rede.
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { localizarFicha, usaFichas } from '../src/fichas-vagas.js';
import { migrarFichas } from '../src/migracao-fichas.js';
import { RAIZ, DIR_DADOS } from '../src/config.js';
import { configuracao, selecionar, importar } from '../src/fonte-estado.js';

function argumento(nome) {
  const i = process.argv.indexOf(nome);
  return i < 0 ? null : process.argv[i + 1];
}

function comandoFichas([acao = 'prever', id, extra]) {
  if (extra) throw new Error('ARGUMENTO_INVALIDO');
  if (['prever', 'migrar', 'recuperar', 'restaurar'].includes(acao) && !id) {
    return migrarFichas(DIR_DADOS, acao);
  }
  if (acao === 'mostrar' && id) {
    if (!usaFichas(DIR_DADOS)) throw new Error('FICHAS_LOCAIS_INATIVAS');
    const registro = localizarFicha(DIR_DADOS, id);
    if (!registro) throw new Error('FICHA_NAO_ENCONTRADA');
    return registro;
  }
  throw new Error('Uso: npm run fichas -- prever|migrar|recuperar|restaurar|mostrar ID');
}

try {
  if (process.argv[2] === '--fichas') {
    console.log(JSON.stringify(comandoFichas(process.argv.slice(3)), null, 2));
  } else {
    comandoFonte();
  }
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
}

function comandoFonte() {
  const fonte = argumento('--fonte');
  const arquivo = argumento('--importar');
  if (fonte && arquivo) throw new Error('Use --fonte ou --importar em comandos separados.');
  if (fonte) {
    const config = selecionar(fonte, argumento('--database-id'));
    console.log(`Fonte de estado: ${config.fonte}${config.databaseId ? ` (${config.databaseId})` : ''}`);
  } else if (arquivo) {
    const caminho = isAbsolute(arquivo) ? arquivo : resolve(RAIZ, arquivo);
    const snapshot = JSON.parse(readFileSync(caminho, 'utf8'));
    const resultado = importar(snapshot);
    console.log(`Notion importado: ${Object.keys(resultado.vagas).length} vagas, ${resultado.paginacao.paginas} página(s), ${resultado.sincronizadoEm}.`);
  } else if (process.argv.length === 2) {
    const config = configuracao();
    console.log(`Fonte de estado: ${config.fonte}${config.databaseId ? ` (${config.databaseId})` : ''}`);
  } else {
    throw new Error('Uso: node scripts/estado.mjs [--fonte local | --fonte notion --database-id ID | --importar data/snapshot.json]');
  }
}
