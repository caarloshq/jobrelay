import test from 'node:test';
import assert from 'node:assert/strict';
import { contarTitulosForaDaArea, resumirTitulosDescartados } from '../src/descartes.js';

test('guarda somente títulos realmente descartados por área, sem mutar o filtro ou o resultado', () => {
  const entradas = [
    { titulo: 'Analista de Dados', motivo: 'titulo fora da area' },
    { titulo: 'Analista de Dados', motivo: 'titulo fora da area' },
    { titulo: 'Designer', motivo: 'salario abaixo do piso' },
    { titulo: '  ', motivo: 'titulo fora da area' },
  ];
  const antes = structuredClone(entradas);
  assert.deepEqual(contarTitulosForaDaArea(entradas), { 'Analista de Dados': 2 });
  assert.deepEqual(entradas, antes);
});

test('frequência agrega relatórios e distingue rodadas antigas sem medição de zero descartes', () => {
  const resumo = resumirTitulosDescartados([
    { dia: '2026-11-01', totais: { descartadas: 80 } },
    { dia: '2026-11-02', titulosDescartadosForaDaArea: {} },
    { dia: '2026-11-03', titulosDescartadosForaDaArea: { 'Analista de Dados': 2, 'Engenheiro': 1 } },
    { dia: '2026-11-04', titulosDescartadosForaDaArea: { 'Analista de Dados': 3 } },
  ]);
  assert.equal(resumo.rodadasSemTitulos, 1);
  assert.equal(resumo.rodadas, 4);
  assert.deepEqual(resumo.titulos, [{ titulo: 'Analista de Dados', quantidade: 5 }, { titulo: 'Engenheiro', quantidade: 1 }]);
});

test('contagem inválida não vira estatística e títulos especiais não alteram protótipos', () => {
  for (const x of [-1, 0, 1.5, '2']) assert.throws(() => resumirTitulosDescartados([{ titulosDescartadosForaDaArea: { X: x } }]), /CONTAGEM_DESCARTE_INVALIDA/);
  const titulos = contarTitulosForaDaArea([{ titulo: '__proto__', motivo: 'titulo fora da area' }]);
  assert.equal(Object.hasOwn(titulos, '__proto__'), true);
  assert.deepEqual(resumirTitulosDescartados([{ titulosDescartadosForaDaArea: titulos }]).titulos, [{ titulo: '__proto__', quantidade: 1 }]);
  assert.equal({}.poluido, undefined);
});


test('CLI lê só relatórios diários, mostra frequência e sinaliza ausência histórica sem gravar dados', async t => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dados = fs.mkdtempSync(path.join(raiz, 'test', 'descartes-fixture-'));
  t.after(() => fs.rmSync(dados, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dados, 'rodada-2026-11-01.json'), JSON.stringify({ dia: '2026-11-01' }));
  fs.writeFileSync(path.join(dados, 'rodada-2026-11-02.json'), JSON.stringify({ dia: '2026-11-02', titulosDescartadosForaDaArea: { 'Analista de Dados': 3 } }));
  fs.writeFileSync(path.join(dados, 'rodada-rascunho.json'), '{invalido');
  const antes = fs.readdirSync(dados).map(f => [f, fs.readFileSync(path.join(dados, f), 'utf8')]);
  const r = spawnSync(process.execPath, ['scripts/descartes.mjs', '--json'], { cwd: raiz, env: { ...process.env, VAGAS_DIR_DADOS: dados, VAGAS_SEM_ENV: '1' }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const resumo = JSON.parse(r.stdout);
  assert.equal(resumo.rodadas, 2);
  assert.equal(resumo.rodadasSemTitulos, 1);
  assert.deepEqual(resumo.titulos, [{ titulo: 'Analista de Dados', quantidade: 3 }]);
  assert.deepEqual(fs.readdirSync(dados).map(f => [f, fs.readFileSync(path.join(dados, f), 'utf8')]), antes);
});
