#!/usr/bin/env node
// Entrada de apresentação. O assistente só chama o evento após conferir a ação correspondente.
import fs from 'node:fs';
import { formatarMensagemOperacao } from '../src/mensagens-operacao.js';
try {
  const [evento, ...extras] = process.argv.slice(2);
  if (!evento || extras.length) throw Error('EVENTO_MENSAGEM_INVALIDO');
  const contexto = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  if (!contexto || typeof contexto !== 'object' || Array.isArray(contexto)) throw Error('CAMPO_MENSAGEM_INVALIDO');
  process.stdout.write(formatarMensagemOperacao(evento, contexto) + '\n');
} catch (e) {
  process.stderr.write(/^[A-Z_]+$/.test(e.message) ? e.message + '\n' : 'MENSAGEM_INVALIDA\n');
  process.exitCode = 1;
}
