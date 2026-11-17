#!/usr/bin/env node
// Consulta somente leitura dos relatórios diários; não altera filtros ou candidaturas.
import fs from 'node:fs';
import path from 'node:path';
import { DIR_DADOS } from '../src/config.js';
import { lerJsonSeguro } from '../src/persistencia.js';
import { resumirTitulosDescartados } from '../src/descartes.js';

try {
  const args = process.argv.slice(2);
  let json = false, limite = 20;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json' && !json) json = true;
    else if (args[i] === '--limite' && /^[1-9]\d*$/.test(args[i + 1] || '')) limite = Number(args[++i]);
    else throw new Error('ARGUMENTO_INVALIDO');
  }
  if (!Number.isSafeInteger(limite)) throw new Error('LIMITE_INVALIDO');
  const arquivos = fs.existsSync(DIR_DADOS) ? fs.readdirSync(DIR_DADOS)
    .filter(f => /^rodada-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
  const resumo = resumirTitulosDescartados(arquivos.map(f => lerJsonSeguro(path.join(DIR_DADOS, f))));
  if (json) console.log(JSON.stringify(resumo));
  else {
    console.log(`Títulos descartados por área em ${resumo.rodadas} relatórios diários`);
    console.log(`Relatórios antigos sem títulos registrados: ${resumo.rodadasSemTitulos}`);
    for (const item of resumo.titulos.slice(0, limite)) console.log(`${item.quantidade} · ${item.titulo}`);
    if (!resumo.titulos.length) console.log('Nenhum título registrado nos relatórios disponíveis; dados antigos não permitem reconstruir os títulos.');
    console.log('Este relatório não muda filtros, notas ou candidaturas.');
  }
} catch (erro) {
  console.error(/^[A-Z_]+$/.test(erro.message) ? erro.message : 'RELATORIO_DESCARTES_INVALIDO');
  process.exitCode = 1;
}
