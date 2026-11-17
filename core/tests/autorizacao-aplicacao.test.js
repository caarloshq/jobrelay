import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aplicacaoAutorizada } from '../src/autorizacao-aplicacao.js';
import { planejarFrentes } from '../src/coordenacao-frentes.js';

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'opt-in-publico-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dados = path.join(root, 'data'), config = path.join(root, 'config');
  fs.mkdirSync(dados); fs.mkdirSync(config);
  const politica = path.join(dados, 'politica-autonomia.json');
  const perfil = path.join(config, 'perfil-candidatura.json');
  fs.writeFileSync(politica, JSON.stringify({ modoCandidatura: 'chrome_assistido' }));
  fs.writeFileSync(perfil, JSON.stringify({ autorizado: true }));
  return { dados, config, politica, perfil };
}

test('opt-in público depois de 16 KB continua válido sem consultar Perfil Markdown', t => {
  const f = fixture(t);
  fs.writeFileSync(f.perfil, JSON.stringify({ nota: 'á'.repeat(16_594), autorizado: true }));
  fs.writeFileSync(f.politica, JSON.stringify({ nota: 'x'.repeat(16_594), modoCandidatura: 'chrome_assistido' }));
  assert.equal(aplicacaoAutorizada(f.dados), true);
  assert.deepEqual(planejarFrentes({ frentes: ['aplicacao'], modoCandidatura: 'chrome_assistido', autorizadoCandidatura: aplicacaoAutorizada(f.dados) }).ativas, ['aplicacao']);
});

test('opt-in público exige booleano true e modo assistido, sem inferir consentimento', t => {
  const f = fixture(t);
  for (const autorizado of [false, 'true', 1, null, undefined]) {
    fs.writeFileSync(f.perfil, JSON.stringify({ nota: 'x'.repeat(20_000), autorizado }));
    assert.equal(aplicacaoAutorizada(f.dados), false);
  }
  fs.writeFileSync(f.perfil, JSON.stringify({ autorizado: true }));
  fs.writeFileSync(f.politica, JSON.stringify({ modoCandidatura: 'mapear' }));
  assert.equal(aplicacaoAutorizada(f.dados), false);
});

test('arquivo ausente, JSON inválido e erro de leitura nunca autorizam', t => {
  const f = fixture(t);
  fs.unlinkSync(f.perfil);
  assert.equal(aplicacaoAutorizada(f.dados), false);
  fs.writeFileSync(f.perfil, '{');
  assert.equal(aplicacaoAutorizada(f.dados), false);
  fs.unlinkSync(f.perfil); fs.mkdirSync(f.perfil);
  assert.equal(aplicacaoAutorizada(f.dados), false);
  fs.rmdirSync(f.perfil); fs.writeFileSync(f.perfil, '{"autorizado":true}');
  fs.unlinkSync(f.politica);
  assert.equal(aplicacaoAutorizada(f.dados), false);
  fs.writeFileSync(f.politica, '{');
  assert.equal(aplicacaoAutorizada(f.dados), false);
});
