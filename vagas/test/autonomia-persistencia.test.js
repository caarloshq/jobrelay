// Incidente 1 de 16 de Novembro de 2026: o Google Drive cria um segundo nome temporário para
// cada arquivo gravado, e a leitura seguinte era bloqueada por `nlink !== 1`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lerJsonSeguro, lerJsonComHash, gravarJsonAtomico, nlinkTolerado } from '../src/persistencia.js';

function cenario(t) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'autonomia-persist-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const dados = path.join(base, 'Documents', 'projeto', 'data');
  const drive = path.join(base, 'Documents', '.tmp.driveupload');
  fs.mkdirSync(dados, { recursive: true }); fs.mkdirSync(drive, { recursive: true });
  return { base, dados, drive };
}

test('segundo nome do Drive não bloqueia a leitura nem a gravação seguinte', t => {
  const { dados, drive } = cenario(t);
  const arquivo = path.join(dados, 'estado.json');
  gravarJsonAtomico(arquivo, { n: 1 });
  fs.linkSync(arquivo, path.join(drive, '84213'));
  assert.equal(fs.statSync(arquivo).nlink, 2);
  assert.deepEqual(lerJsonSeguro(arquivo), { n: 1 });
  assert.match(lerJsonComHash(arquivo).hash, /^[a-f0-9]{64}$/);
  // A gravação troca o arquivo inteiro: o nome do Drive guarda o conteúdo antigo e o novo fica exclusivo.
  gravarJsonAtomico(arquivo, { n: 2 });
  assert.equal(fs.statSync(arquivo).nlink, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(drive, '84213'), 'utf8')), { n: 1 });
  assert.deepEqual(lerJsonSeguro(arquivo), { n: 2 });
});

test('o nome temporário pode estar numa subpasta do Drive', t => {
  const { dados, drive } = cenario(t);
  const arquivo = path.join(dados, 'estado.json');
  gravarJsonAtomico(arquivo, { n: 1 });
  fs.mkdirSync(path.join(drive, 'lote-7'));
  fs.linkSync(arquivo, path.join(drive, 'lote-7', 'a'));
  assert.deepEqual(lerJsonSeguro(arquivo), { n: 1 });
});

test('segundo nome fora das pastas do Drive continua barrado', t => {
  const { base, dados } = cenario(t);
  const arquivo = path.join(dados, 'estado.json');
  gravarJsonAtomico(arquivo, { n: 1 });
  fs.mkdirSync(path.join(base, 'outro'));
  fs.linkSync(arquivo, path.join(base, 'outro', 'copia.json'));
  assert.throws(() => lerJsonSeguro(arquivo), /CAMINHO_INSEGURO/);
  assert.throws(() => gravarJsonAtomico(arquivo, { n: 2 }), /CAMINHO_INSEGURO/);
});

test('três nomes, só um deles do Drive: barra', t => {
  const { base, dados, drive } = cenario(t);
  const arquivo = path.join(dados, 'estado.json');
  gravarJsonAtomico(arquivo, { n: 1 });
  fs.linkSync(arquivo, path.join(drive, '1'));
  fs.linkSync(arquivo, path.join(base, 'intruso.json'));
  assert.equal(fs.statSync(arquivo).nlink, 3);
  assert.throws(() => lerJsonSeguro(arquivo), /CAMINHO_INSEGURO/);
});

test('link simbólico continua barrado, com ou sem Drive', t => {
  const { base, dados, drive } = cenario(t);
  const real = path.join(base, 'real.json'); fs.writeFileSync(real, '{"x":1}');
  const alvo = path.join(dados, 'atalho.json'); fs.symlinkSync(real, alvo);
  assert.throws(() => lerJsonSeguro(alvo), /CAMINHO_INSEGURO/);
  fs.linkSync(real, path.join(drive, '9'));
  assert.throws(() => lerJsonSeguro(alvo), /CAMINHO_INSEGURO/);
});

test('pasta extra de nomes conhecidos pode ser declarada pelo ambiente', t => {
  const { base, dados } = cenario(t);
  const arquivo = path.join(dados, 'estado.json');
  gravarJsonAtomico(arquivo, { n: 1 });
  const backup = path.join(base, 'backup-conhecido'); fs.mkdirSync(backup);
  fs.linkSync(arquivo, path.join(backup, 'a'));
  assert.throws(() => lerJsonSeguro(arquivo), /CAMINHO_INSEGURO/);
  process.env.VAGAS_PASTAS_LINK_CONHECIDO = backup;
  t.after(() => { delete process.env.VAGAS_PASTAS_LINK_CONHECIDO; });
  assert.deepEqual(lerJsonSeguro(arquivo), { n: 1 });
});

test('nlinkTolerado: exclusivo passa, pasta e inexistente não são tolerados como arquivo', t => {
  const { dados } = cenario(t);
  const arquivo = path.join(dados, 'a.json'); fs.writeFileSync(arquivo, '{}');
  assert.equal(nlinkTolerado(arquivo, fs.lstatSync(arquivo)), true);
  assert.equal(nlinkTolerado(dados, { nlink: 3, isFile: () => false, isSymbolicLink: () => false }), false);
});

test('pasta "do Drive" que é link simbólico não vale, nem uma subpasta que seja', t => {
  const { base, dados, drive } = cenario(t);
  const secreto = path.join(base, 'segredos'); fs.mkdirSync(secreto);
  const real = path.join(secreto, 'token.json'); fs.writeFileSync(real, '{"segredo":"abc"}');
  const alvo = path.join(dados, 'vagas.json'); fs.linkSync(real, alvo);
  assert.throws(() => lerJsonSeguro(alvo), /CAMINHO_INSEGURO/);
  fs.rmSync(drive, { recursive: true }); fs.symlinkSync(secreto, drive);
  assert.throws(() => lerJsonSeguro(alvo), /CAMINHO_INSEGURO/);
  // Subpasta simbólica dentro de uma pasta do Drive de verdade.
  fs.rmSync(drive); fs.mkdirSync(drive); fs.symlinkSync(secreto, path.join(drive, 'lote'));
  assert.throws(() => lerJsonSeguro(alvo), /CAMINHO_INSEGURO/);
});

test('o mesmo nome não é contado duas vezes quando a pasta conhecida aparece em dobro', t => {
  const { base, dados } = cenario(t);
  const arquivo = path.join(dados, 'estado.json'); gravarJsonAtomico(arquivo, { n: 1 });
  const pasta = path.join(base, 'conhecida'); fs.mkdirSync(path.join(pasta, 'sub'), { recursive: true });
  fs.linkSync(arquivo, path.join(pasta, 'sub', 'a')); fs.linkSync(arquivo, path.join(base, 'intruso.json'));
  process.env.VAGAS_PASTAS_LINK_CONHECIDO = [pasta, path.join(pasta, 'sub')].join(path.delimiter);
  t.after(() => { delete process.env.VAGAS_PASTAS_LINK_CONHECIDO; });
  assert.equal(fs.statSync(arquivo).nlink, 3);
  assert.throws(() => lerJsonSeguro(arquivo), /CAMINHO_INSEGURO/);
});
