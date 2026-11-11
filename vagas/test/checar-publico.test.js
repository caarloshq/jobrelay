import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const vagas = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(vagas, 'data/testes-checker');
function checar(t, conteudo) {
  fs.mkdirSync(base, { recursive: true });
  const raiz = fs.mkdtempSync(path.join(base, 'fixture-'));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  fs.mkdirSync(path.join(raiz, 'vagas/scripts'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'vagas/src'));
  fs.writeFileSync(path.join(raiz, 'vagas/src/config.js'), "import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path'; export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');");
  fs.writeFileSync(path.join(raiz, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(raiz, 'vagas/package.json'), '{"scripts":{}}');
  fs.copyFileSync(path.join(vagas, 'scripts/checar-publico.mjs'), path.join(raiz, 'vagas/scripts/checar-publico.mjs'));
  fs.writeFileSync(path.join(raiz, 'conteudo.md'), conteudo);
  const init = spawnSync('git', ['init', raiz], { encoding: 'utf8' });
  assert.equal(init.status, 0);
  return spawnSync(process.execPath, [path.join(raiz, 'vagas/scripts/checar-publico.mjs')], { encoding: 'utf8' });
}
test('URLs públicas exatas são permitidas sem dispensar dado pessoal na mesma linha', t => {
  const telefone = ['+55', '11', '99999-1111'].join(' ');
  for (const url of [
    'https://github.com/caarloshq/jobrelay',
    'https://github.com/caarloshq/jobrelay.git',
    'https://github.com/caarloshq/job-scrapper.git',
    'https://api.github.com/repos/caarloshq/jobrelay',
    'https://github.com/caarloshq/jobrelay/releases/latest',
    'https://api.github.com/repos/caarloshq/jobrelay/releases/latest',
  ]) {
    assert.equal(checar(t, url).status, 0, url);
    assert.equal(checar(t, `${url} ${telefone}`).status, 1, url);
  }
});
test('nome protegido e URLs com host ou sufixo alterados continuam bloqueados', t => {
  const nome = ['caar', 'loshq'].join('');
  for (const conteudo of [
    nome,
    `https://github.com/${nome}/jobrelay-alterado`,
    `https://github.com.evil.example/${nome}/jobrelay.git`,
    `https://evil.example/?next=https://github.com/${nome}/jobrelay.git`,
    `https://github.com/${nome}/jobrelay.git/extra`,
    `https://github.com/${nome}/jobrelay.git.evil`,
    `https://github.com/${nome}/jobrelay.git?token=teste`,
    `http://github.com/${nome}/jobrelay.git`,
    `https://github.com/${nome}/job-scrapper.git/extra`,
    `https://github.com/${nome}/job-scrapper.git.evil`,
    `https://github.com/${nome}/jobrelay/releases/latest/extra`,
    `https://github.com/${nome}/jobrelay/releases/latest?token=teste`,
    `https://api.github.com/repos/${nome}/jobrelay/releases/latest/extra`,
    `https://api.github.com.evil.example/repos/${nome}/jobrelay/releases/latest`,
  ]) assert.equal(checar(t, conteudo).status, 1, conteudo);
});

test('nome de empresa exige separação de palavras; variáveis do sistema não vazam dados', t => {
  assert.equal(checar(t, 'ambiente.PROGRAMFILES').status, 0);
  assert.equal(checar(t, 'ambiente["PROGRAMFILES(X86)"]').status, 0);
  // O nome protegido permanece na regra canônica, sem duplicar dado sensível
  // no arquivo publicável do teste. Extraímos o literal da regra com limites.
  const checker = fs.readFileSync(path.join(vagas, 'scripts/checar-publico.mjs'), 'utf8');
  const empresa = checker.match(/\(\?<\!\[[^\]]+\]\)([a-z]+)\(\?!/i)?.[1];
  assert.ok(empresa, 'regra de empresa com limites precisa existir');
  for (const texto of [empresa, empresa.toUpperCase(), `empresa: ${empresa}`, `cliente_${empresa}_privado`]) {
    assert.equal(checar(t, texto).status, 1);
  }
});
