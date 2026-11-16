// Spec 015: fronteiras da coleta 2 que nenhum teste de comportamento cobre.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = rel => fs.readFileSync(path.join(raiz, rel), 'utf8');

test('o caminho da coleta 2 não importa a Apify nem a cota paga', () => {
  const arquivos = ['src/coordenacao-frentes.js', 'src/rodada-lote.js', 'scripts/rodada-lote.mjs', 'scripts/linkedin-feed.mjs',
    'src/linkedin-feed.js', 'src/linkedin-feed-sessao.js', 'src/linkedin-feed-config.js', 'src/linkedin-feed-entrada.js'];
  for (const arquivo of arquivos) {
    const importacoes = ler(arquivo).split('\n').filter(l => /^\s*(import\b|.*\bimport\()/.test(l) || /\brequire\(/.test(l));
    assert.deepEqual(importacoes.filter(l => /apify|cota-apify/i.test(l)), [], arquivo);
  }
});
