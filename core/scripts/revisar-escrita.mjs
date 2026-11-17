#!/usr/bin/env node
// Indícios mecânicos para revisão editorial. Não são um veredito de qualidade.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const borda = fonte => new RegExp(`(?<![\\p{L}\\p{N}])(?:${fonte})(?![\\p{L}\\p{N}])`, 'giu');

export const PADROES = Object.freeze([
  { id: 'abertura-generica', grau: 'Deveria', dica: 'Comece pelo fato ou pela decisão.', regex: borda('no (?:cenário|contexto) atual|nos dias de hoje|in today.s (?:world|landscape)|imagine (?:só|this)') },
  { id: 'aviso-vazio', grau: 'Deveria', dica: 'Entregue a informação sem anunciar que ela vem.', regex: borda('vale (?:notar|ressaltar|destacar)|é importante (?:notar|ressaltar)|it.s important to note') },
  { id: 'jargao-vago', grau: 'Deveria', dica: 'Nomeie a ação, a pessoa e o efeito verificável.', regex: borda('solução robusta|experiência transformadora|alavancar sinergias?|unlock (?:potential|synergies)|seamless experience') },
  { id: 'contraste-formula', grau: 'Considera', dica: 'Diga a diferença concreta ou afirme a ideia diretamente.', regex: borda('não é apenas|não se trata apenas de|it.s not just about') },
  { id: 'fecho-automatico', grau: 'Deveria', dica: 'Termine na última informação útil ou indique uma ação específica.', regex: borda('em conclusão|no fim das contas|espero ter ajudado|in conclusion|hope this helps') },
  { id: 'chamada-generica', grau: 'Considera', dica: 'Peça uma ação ligada ao conteúdo ou corte a chamada.', regex: borda('me conta nos comentários|salve este post|let me know your thoughts') },
  { id: 'promessa-absoluta', grau: 'Bloqueia', dica: 'Confira a prova e o alcance da promessa antes de publicar.', regex: borda('resultado garantido|100% garantido|guaranteed results?') },
  { id: 'marca-sem-conteudo', grau: 'Deveria', dica: 'Especifique o que foi feito e para quem.', regex: borda('fazer a diferença|transformar vidas|make a difference') },
]);

export function analisarTexto(conteudo, arquivo = '<texto>') {
  if (typeof conteudo !== 'string') throw new TypeError('Texto inválido para revisão.');
  const achados = [];
  for (const [indice, linha] of conteudo.split(/\r?\n/u).entries()) {
    for (const padrao of PADROES) {
      const regex = new RegExp(padrao.regex.source, padrao.regex.flags);
      for (const match of linha.matchAll(regex)) {
        achados.push({ arquivo, linha: indice + 1, id: padrao.id, grau: padrao.grau,
          trecho: match[0], contexto: linha.trim().slice(0, 160), dica: padrao.dica });
      }
    }
  }
  return achados;
}

export function executar(arquivos, { ler = readFileSync, escrever = console.log } = {}) {
  if (!arquivos.length) throw new Error('Uso: npm run revisar:escrita -- <arquivo> [outro...]');
  let total = 0;
  for (const arquivo of arquivos) {
    const achados = analisarTexto(ler(arquivo, 'utf8'), arquivo);
    total += achados.length;
    for (const a of achados) escrever(`${a.arquivo}:${a.linha} [${a.grau}] ${a.id}: “${a.trecho}”. ${a.dica}`);
  }
  if (!total) escrever('Nenhum indício mecânico. A leitura humana de fatos, voz e sentido ainda é necessária.');
  return total ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = executar(process.argv.slice(2)); }
  catch (erro) { console.error(erro.message); process.exitCode = 2; }
}
