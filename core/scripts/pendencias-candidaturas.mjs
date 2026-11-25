#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { lerPendencias, registrarPendencias, atualizarPendencia, projetarPendencias } from '../src/pendencias-candidaturas.js';
import { DIR_DADOS } from '../src/config.js';
import { garantirFichas } from '../src/migracao-fichas.js';
try {
  const [acao, ...argv] = process.argv.slice(2);
  const opcoes = {};
  while (argv.length) {
    const chave = argv.shift(), valor = argv.shift();
    if (!valor || !['--dados', '--arquivo', '--id', '--prova'].includes(chave) || opcoes[chave]) throw new Error('ARGUMENTO_INVALIDO');
    opcoes[chave] = valor;
  }
  const dados = path.resolve(opcoes['--dados'] || process.env.VAGAS_DIR_DADOS || DIR_DADOS);
  if (!opcoes['--dados'] && !process.env.VAGAS_DIR_DADOS) garantirFichas(dados);
  let resultado;
  if (acao === 'listar') resultado = lerPendencias(dados);
  else if (acao === 'registrar') {
    if (!opcoes['--arquivo']) throw new Error('ARQUIVO_OBRIGATORIO');
    const entrada = JSON.parse(fs.readFileSync(path.resolve(opcoes['--arquivo']), 'utf8'));
    resultado = registrarPendencias(dados, Array.isArray(entrada) ? entrada : [entrada]);
  } else if (['realizada', 'resolver', 'dispensar'].includes(acao)) {
    if (!opcoes['--id']) throw new Error('ID_OBRIGATORIO');
    resultado = atualizarPendencia(dados, opcoes['--id'], { realizada: 'realizada_aguardando_conferencia', resolver: 'resolvida', dispensar: 'dispensada_com_prova' }[acao], opcoes['--prova']);
  } else if (acao === 'projetar') {
    resultado = projetarPendencias(dados);
  } else throw new Error('ACAO_INVALIDA');
  process.stdout.write(JSON.stringify({ ok: true, resultado }) + '\n');
} catch (e) {
  process.stderr.write(JSON.stringify({ ok: false, erro: /^[A-Z_]+$/.test(e.message) ? e.message : 'ENTRADA_OU_PERSISTENCIA_INVALIDA' }) + '\n');
  process.exitCode = 1;
}
