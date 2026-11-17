import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = readFileSync(new URL('../../docs/modelo-notion/quadro.json', import.meta.url), 'utf8');
const modelo = JSON.parse(json);
const campos = modelo.propriedades;
const nomes = new Set(Object.keys(campos));

test('bundle é saneado, com 19 campos core e um exemplo excluído da operação', () => {
  assert.equal(modelo.nome, 'Puxa Vagas');
  assert.equal(nomes.size, 19);
  assert.equal(modelo.exemplos.length, 1);
  assert.equal(modelo.exemplos[0]['ID externo'], 'exemplo:vaga-001');
  assert.deepEqual(modelo.operacao.excludedIds, ['exemplo:vaga-001']);
  assert.equal(new URL(modelo.exemplos[0].Link).hostname, 'example.com');
  assert.match(modelo.exemplos[0].Vaga, /fictício/);
  assert.equal(modelo.exemplos[0].Salário, null);
  assert.deepEqual(modelo.exemplos[0].Currículo, []);
  assert.equal(modelo.exemplos[0]['Currículo (caminho)'], null);
  assert.doesNotMatch(json, /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32}|app\.notion|notion\.so|\/Users\/|[A-Z]:\\Users\\|api[_-]?key|access[_-]?token|password|senha/i);
  for (const campo of ['Estrelas', 'Idade', '✓ Concluir ']) assert.equal(nomes.has(campo), false);
});

test('contrato pede Confiança percentual com barra; quatro grupos mantêm Status primeiro', () => {
  assert.equal(campos.Confiança.number_format, 'percent');
  assert.deepEqual(campos.Confiança.show_as, { type: 'bar', color: 'green', maxValue: 1, showValue: true });
  assert.equal(modelo.exemplos[0].Confiança * 100, 75);
  assert.deepEqual(modelo.layout.main.find(m => m.type === 'title').pinnedProperties, ['Confiança']);
  assert.deepEqual(modelo.layout.main.find(m => m.type === 'properties').sections.map(s => s.name), ['Sobre a vaga', 'Próxima ação', 'Datas', 'Candidatura']);
  assert.equal(modelo.layout.main.find(m => m.type === 'properties').sections[0].properties[0].property, 'Status');
  for (const secao of modelo.layout.main.find(m => m.type === 'properties').sections) for (const campo of secao.properties) assert.ok(nomes.has(campo.property));
  assert.ok(modelo.layout.main.find(m => m.type === 'properties').sections.flatMap(s => s.properties).some(p => p.property === 'Salário' && p.visibility === 'hide_if_empty'));
  assert.match(modelo.compatibilidade.seNaoSuportado, /Não declare barra/);
});

test('cinco filas possuem filtros próprios e referências válidas', () => {
  assert.deepEqual(modelo.visualizacoes.map(v => v.name), ['Todas as vagas', 'Quadro', 'Para aplicar', 'Precisa de atenção', 'Candidaturas']);
  const [todas, quadro, aplicar, atencao, candidaturas] = modelo.visualizacoes;
  assert.equal(quadro.type, 'board');
  assert.equal(quadro.advancedFilter.filters.length, 6);
  assert.equal(quadro.advancedFilter.filters.some(f => f.value.value === 'Revisar'), false);
  assert.equal(todas.advancedFilter, undefined);
  assert.equal(aplicar.advancedFilter.filters[0].value.value, 'Aplicar');
  assert.equal(atencao.advancedFilter.operator, 'or');
  assert.equal(atencao.advancedFilter.filters[0].value.value, 'Revisar');
  assert.equal(atencao.advancedFilter.filters[1].operator, 'is_not_empty');
  assert.deepEqual(candidaturas.advancedFilter.filters.map(f => f.value.value), ['Aplicado por IA', 'Já apliquei', 'Entrevista']);
  const status = new Set(campos.Status.options.map(o => o.name));
  for (const v of modelo.visualizacoes) {
    for (const p of v.displayProperties) assert.ok(nomes.has(p));
    for (const p of v.sorts) assert.ok(nomes.has(p.property));
    for (const f of v.advancedFilter?.filters ?? []) {
      assert.ok(nomes.has(f.property));
      if (f.property === 'Status') assert.ok(status.has(f.value.value));
    }
  }
});

test('logo confirmado serve apenas como ícone; ausentes não bloqueiam vagas', () => {
  assert.equal(modelo.icones.property, 'page.icon');
  assert.equal(modelo.icones.cover, null);
  assert.equal(new URL(modelo.icones.exemplo.url).hostname, 'attachments.gupy.io');
  assert.match(modelo.icones.sourcePolicy, /Sem fonte confirmada, deixe sem ícone e registre a limitação no relatório técnico/);
  assert.match(modelo.icones.sourcePolicy, /sem preencher Pendência operacional, descartar a vaga ou bloquear candidatura/);
});
