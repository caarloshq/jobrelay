import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarBaseRespostas } from '../src/base-respostas.js';
import { lerFontes, renderizarFontes } from '../src/fontes-respostas.js';

const ancora = '<a id="arsenal-de-entrevista"></a>\n\n# Respostas para entrevista e candidaturas\n\n';
const quinze = Array.from({ length: 15 }, (_, indice) => {
  const numero = indice + 1;
  const pergunta = numero === 15 ? 'Você já utilizou o framework HEART para analisar métricas?' : `Pergunta fictícia ${numero}?`;
  const texto = numero === 15 ? 'Já utilizei o framework HEART para analisar métricas.' : `Resposta fictícia ${numero}.`;
  return `## ${numero}. ${pergunta}\n\n> ${texto}\n`;
}).join('\n');

function fontes(secao = `${ancora}${quinze}\n## Perguntas para fazer ao entrevistador\n`) {
  const geradas = renderizarFontes({ banco: { perguntas: [] }, perfil: { identidade: { nome: 'Pessoa Fictícia' } } }, { arsenal: false });
  return { ...geradas, respostas: `${geradas.respostas}\n### Pergunta 210: texto legado sem autoridade\n\n${secao}` };
}

test('consulta 15 narrativas e HEART da seção exata sem aprovação automática ou Pergunta 210', () => {
  const textos = fontes();
  const { banco, perfil } = lerFontes(textos);
  assert.deepEqual(banco.perguntas, []);
  assert.equal(perfil.identidade.nome, 'Pessoa Fictícia');
  const saida = consultarBaseRespostas(textos.respostas, banco);
  assert.equal(saida.fonte, 'aplicacao/RESPOSTAS.md#arsenal-de-entrevista');
  assert.match(saida.sha256, /^[a-f0-9]{64}$/);
  assert.equal(saida.total, 15);
  assert.equal(saida.perguntas[14].numero, 15);
  assert.match(saida.perguntas[14].markdown, /Já utilizei o framework HEART para analisar métricas\./);
  assert.doesNotMatch(saida.markdown, /Pergunta 210/);
  assert.equal(JSON.stringify(saida).includes('"aprovada"'), false);
  assert.equal(JSON.stringify(saida).includes('"resposta"'), false);
});

test('registro legado em Respostas ou Perfil bloqueia consulta antes de qualquer fallback', () => {
  for (const pergunta of ['Conte uma experiência.', 'Qual seu telefone?']) {
    const geradas = renderizarFontes({
      banco: { perguntas: [{ pergunta, resposta: 'Texto legado.', aprovada: true, fonte: 'legado' }] },
      perfil: { identidade: { nome: 'Pessoa Fictícia' } },
    }, { arsenal: false });
    const textos = { ...geradas, respostas: `${geradas.respostas}\n${ancora}${quinze}\n## Acesso no Notion\n` };
    const { banco } = lerFontes(textos);
    assert.throws(() => consultarBaseRespostas(textos.respostas, banco), /ERRO_LEGADO_ATIVO/);
  }
});

test('falta de seção, terminador e sequência falha sem consultar texto anterior', () => {
  const banco = lerFontes(fontes()).banco;
  for (const secao of [
    quinze,
    `${ancora}${quinze}`,
    `${ancora}${quinze.replace('## 8.', '## 18.')}\n## Acesso no Notion\n`,
  ]) {
    assert.throws(() => consultarBaseRespostas(fontes(secao).respostas, banco), /BASE_AUSENTE|BASE_INCOMPLETA/);
  }
});

test('modelo público permanece pendente e não vira resposta aprovada', () => {
  const modelo = quinze.replace('Já utilizei o framework HEART para analisar métricas.', 'Pendente de resposta da pessoa candidata.');
  const textos = fontes(`${ancora}${modelo}\n## Acesso no Notion\n`);
  const saida = consultarBaseRespostas(textos.respostas, lerFontes(textos).banco);
  assert.equal(saida.total, 15);
  assert.match(saida.perguntas[14].markdown, /Pendente de resposta da pessoa candidata\./);
  assert.equal(JSON.stringify(saida).includes('"aprovada":true'), false);
});
