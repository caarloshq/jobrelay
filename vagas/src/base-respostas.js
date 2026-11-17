import { createHash } from 'node:crypto';

const FONTE = 'aplicacao/RESPOSTAS.md#arsenal-de-entrevista';
const ANCORA = '<a id="arsenal-de-entrevista"></a>';
const TITULO = '# Respostas para entrevista e candidaturas';
const FIM = new Set(['## Perguntas para fazer ao entrevistador', '## Acesso no Notion']);

function falhar(codigo, detalhe) {
  throw new Error(`${codigo}: ${detalhe}`);
}

export function consultarBaseRespostas(respostas, banco, { fonte = FONTE } = {}) {
  if (!banco || !Array.isArray(banco.perguntas)) falhar('FONTE_INVALIDA', 'banco v1 não validado');
  if (banco.perguntas.length !== 0) falhar('ERRO_LEGADO_ATIVO', `${banco.perguntas.length} registros antigos ainda ativos`);
  if (typeof respostas !== 'string') falhar('BASE_AUSENTE', 'Markdown de Respostas ausente');

  const linhas = respostas.split('\n');
  const ancoras = linhas.flatMap((linha, indice) => linha.trim() === ANCORA ? [indice] : []);
  if (ancoras.length !== 1) falhar('BASE_AUSENTE', 'âncora única do Arsenal não encontrada');
  let inicio = ancoras[0] + 1;
  while (linhas[inicio] === '') inicio++;
  if (linhas[inicio] !== TITULO) {
    falhar('BASE_AUSENTE', 'título da seção de Respostas ausente após a âncora');
  }
  const fim = linhas.findIndex((linha, indice) => indice > inicio && FIM.has(linha));
  if (fim < 0) falhar('BASE_INCOMPLETA', 'terminador da seção de Respostas ausente');
  const secao = linhas.slice(inicio, fim);
  while (secao.at(-1) === '') secao.pop();
  const perguntas = [];
  let primeira = -1;
  for (let i = 0; i < secao.length; i++) {
    const linha = secao[i];
    const titulo = /^## ([1-9]\d*)\. (.+)$/.exec(linha);
    if (!titulo) {
      if (primeira >= 0 && /^## /.test(linha)) falhar('BASE_INCOMPLETA', `subseção inesperada: ${linha}`);
      continue;
    }
    if (primeira >= 0) perguntas.at(-1).markdown = secao.slice(primeira, i).join('\n').trimEnd();
    const numero = Number(titulo[1]);
    if (numero !== perguntas.length + 1) falhar('BASE_INCOMPLETA', `numeração fora de sequência: ${numero}`);
    perguntas.push({ numero, pergunta: titulo[2].trim(), markdown: '' });
    primeira = i;
  }
  if (primeira < 0) falhar('BASE_INCOMPLETA', 'nenhuma pergunta numerada encontrada');
  perguntas.at(-1).markdown = secao.slice(primeira).join('\n').trimEnd();
  for (const item of perguntas) {
    if (!/^> .+/m.test(item.markdown)) falhar('BASE_INCOMPLETA', `resposta narrativa ausente na pergunta ${item.numero}`);
  }
  return {
    fonte,
    sha256: createHash('sha256').update(respostas).digest('hex'),
    total: perguntas.length,
    markdown: secao.join('\n'),
    perguntas,
  };
}
