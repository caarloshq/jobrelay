import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisarTexto, executar, PADROES } from '../scripts/revisar-escrita.mjs';

test('canário sintético cobre cada indício sem usar dados de pessoa real', () => {
  const texto = [
    'No cenário atual, uma solução robusta vai fazer a diferença.',
    'É importante notar: o resultado é 100% garantido.',
    'Não é apenas design. Em conclusão, espero ter ajudado.',
    'Me conta nos comentários.',
  ].join('\n');
  const achados = analisarTexto(texto);
  assert.deepEqual(new Set(achados.map(x => x.id)), new Set(PADROES.map(x => x.id)));
  assert.ok(achados.every(x => Number.isInteger(x.linha) && x.linha > 0));
});

test('texto específico passa sem achado mecânico, mas sem aprovação semântica', () => {
  const texto = 'A fila mostra três vagas para leitura. O anúncio exige Figma e pesquisa com usuários.';
  assert.deepEqual(analisarTexto(texto), []);
  const saida = [];
  assert.equal(executar(['exemplo.md'], { ler: () => texto, escrever: x => saida.push(x) }), 0);
  assert.match(saida[0], /leitura humana/);
});

test('CLI lógica informa localização e retorna 1 quando há indício', () => {
  const saida = [];
  const codigo = executar(['rascunho.md'], { ler: () => 'Linha limpa\nResultado garantido.', escrever: x => saida.push(x) });
  assert.equal(codigo, 1);
  assert.match(saida[0], /rascunho\.md:2 \[Bloqueia\]/);
});

test('palavra dentro de outra não gera falso positivo', () => {
  assert.deepEqual(analisarTexto('O termo contratransformar não é um anúncio.'), []);
});
