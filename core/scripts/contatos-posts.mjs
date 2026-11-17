#!/usr/bin/env node
// Contatos de posts do LinkedIn (spec 016). Comentar não existe aqui, de propósito.
//   proximas                         o que o agente pode fazer sem perguntar e o que depende de a pessoa candidata
//   conectado  --id ID --prova TXT   o convite (sem nota) foi enviado
//   preparar   --id ID --arquivo F   {texto, canal: linkedin|email, anexo?, revisaoRef}; devolve a pergunta e o hash
//   autorizar  --id ID --ref TXT --hash H   o "sim" de a pessoa candidata àquele texto
//   enviado    --id ID --prova TXT   a mensagem saiu (recibo visível)
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { proximasAcoes, registrarConexao, prepararMensagem, perguntaDeAutorizacao, registrarAutorizacao, registrarEnvio, listar } from '../src/contatos-posts.js';
import { lerJsonSeguro } from '../src/persistencia.js';

export function main(argv = process.argv.slice(2), saida = v => process.stdout.write(`${JSON.stringify(v, null, 2)}\n`)) {
  const [acao = 'proximas', ...resto] = argv, o = {};
  for (let i = 0; i < resto.length; i += 2) {
    if (!['--id', '--prova', '--arquivo', '--ref', '--hash'].includes(resto[i]) || resto[i + 1] === undefined) throw new Error('ARGUMENTO_INVALIDO');
    o[resto[i]] = resto[i + 1];
  }
  let r;
  if (acao === 'proximas') r = proximasAcoes();
  else if (acao === 'listar') r = listar();
  else if (acao === 'conectado') r = registrarConexao(o['--id'], { provaRef: o['--prova'] });
  else if (acao === 'preparar') {
    const d = lerJsonSeguro(resolve(o['--arquivo'] || (() => { throw new Error('ARQUIVO_OBRIGATORIO'); })()));
    const lead = prepararMensagem(o['--id'], { texto: d.texto, canal: d.canal, anexo: d.anexo ?? null, revisaoRef: d.revisaoRef });
    r = { pergunta: perguntaDeAutorizacao(lead), hashMostrado: lead.mensagem.hash };
  } else if (acao === 'autorizar') r = registrarAutorizacao(o['--id'], { autorizacaoRef: o['--ref'], hashMostrado: o['--hash'] });
  else if (acao === 'enviado') r = registrarEnvio(o['--id'], { provaRef: o['--prova'] });
  else throw new Error('ACAO_DESCONHECIDA');
  saida(r); return r;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main(); } catch (e) { process.stderr.write(`${JSON.stringify({ ok: false, erro: e.message })}\n`); process.exitCode = 1; }
}
