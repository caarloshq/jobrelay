import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatarDataPublicacao, prepararNota } from './preparar-nota-release.mjs';

const fixture = '# JobRelay 1.6.0\n\nDATA_PUBLICACAO\n\nSeu progresso continua.\n';
const script = fileURLToPath(new URL('./preparar-nota-release.mjs', import.meta.url));

test('data usa dia de Sao Paulo e mes com inicial maiuscula', () => {
  assert.equal(formatarDataPublicacao(new Date('2026-11-17T01:30:00Z')), '16 de Novembro de 2026');
  assert.equal(formatarDataPublicacao(new Date('2026-11-17T03:00:00Z')), '17 de Novembro de 2026');
  assert.equal(formatarDataPublicacao(new Date('2027-01-01T02:59:59Z')), '31 de Dezembro de 2026');
  assert.equal(formatarDataPublicacao(new Date('2027-01-01T03:00:00Z')), '1 de Janeiro de 2027');
});

test('preparacao troca so o marcador, sem alterar o restante nem a origem', () => {
  const pronto = prepararNota(fixture, new Date('2026-11-17T12:00:00Z'));
  assert.equal(pronto, fixture.replace('DATA_PUBLICACAO', '17 de Novembro de 2026'));
  assert.equal(fixture.includes('DATA_PUBLICACAO'), true);
  assert.equal(pronto.includes('DATA_PUBLICACAO'), false);
});

test('nota ausente de marcador, repetida ou data invalida falha fechada', () => {
  for (const texto of ['', '# Nota ja datada', 'DATA_PUBLICACAO\nDATA_PUBLICACAO']) {
    assert.throws(() => prepararNota(texto, new Date('2026-11-17T12:00:00Z')), /MARCADOR/);
  }
  assert.throws(() => prepararNota(fixture, new Date('invalid')), /DATA_INVALIDA/);
});

test('CLI produz arquivo temporario exclusivo e preserva bytes da fonte', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobrelay-nota-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const origem = path.join(dir, 'nota.md'), destino = path.join(dir, 'pronta.md');
  fs.writeFileSync(origem, fixture);
  execFileSync(process.execPath, [script, origem, destino], { env: { ...process.env, TZ: 'Pacific/Auckland' } });
  assert.equal(fs.readFileSync(origem, 'utf8'), fixture);
  assert.match(fs.readFileSync(destino, 'utf8'), /\d{1,2} de [A-Z][a-zç]+ de \d{4}/u);
  assert.equal(fs.readFileSync(destino, 'utf8').includes('DATA_PUBLICACAO'), false);
  const antes = fs.readFileSync(destino);
  assert.notEqual(spawnSync(process.execPath, [script, origem, destino]).status, 0);
  assert.deepEqual(fs.readFileSync(destino), antes);
  assert.notEqual(spawnSync(process.execPath, [script, origem, origem]).status, 0);
  assert.equal(fs.readFileSync(origem, 'utf8'), fixture);
});
