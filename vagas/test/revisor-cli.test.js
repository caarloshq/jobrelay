import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const raiz = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(raiz, 'scripts/validar-respostas.mjs');
const rodar = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
test('CLI prepara fontes locais, confere parecer e recusa fonte alterada ou link inseguro', t => {
  const pasta = fs.mkdtempSync(path.join(raiz, 'data/test-revisor-cli-'));
  t.after(() => fs.rmSync(pasta, { recursive: true, force: true }));
  const fato = path.join(pasta, 'fato.md'); fs.writeFileSync(fato, 'Disponibilidade confirmada na simulação.');
  const arquivo = path.join(pasta, 'candidatura.json');
  const c = { idExterno: 'fixture:123', empresa: 'Empresa Sintética', vaga: 'Designer', idioma: 'pt-BR', descricaoFonte: 'https://empresa.example/jobs/123', estado: 'rascunho', autorRespostas: 'autor',
    respostas: [{ pergunta: 'Qual sua disponibilidade?', resposta: 'Disponibilidade imediata.', fonte: fato, escopo: 'geral', aprovada: true }],
    autorizacaoEnvio: { em: '2026-11-09', referencia: 'autorizacao-2026-11-09.md' } };
  const salvar = () => fs.writeFileSync(arquivo, JSON.stringify(c)); salvar();
  const preparado = rodar('--preparar-revisao', arquivo); assert.equal(preparado.status, 0, preparado.stderr);
  const p = JSON.parse(preparado.stdout); c.fontesEscrita = p.fontesEscrita;
  assert.equal(p.fontesEscrita.find(f => f.papel === 'voz').hash, p.fontesEscrita.find(f => f.papel === 'escrita').hash);
  c.revisaoEscrita = { revisor: 'editor', decisao: 'aprovado', hashPacote: p.hashPacote, achados: [], criterios: Object.fromEntries(['pergunta','clareza','fatos','voz','escopo'].map(k => [k, { ok: true, evidencia: 'A pergunta “Qual sua disponibilidade?” recebe a resposta direta comprovada na fonte sintética.' }])) }; salvar();
  assert.equal(rodar('--candidatura', arquivo).status, 0);
  fs.appendFileSync(fato, ' Alteração.');
  const alterada = rodar('--candidatura', arquivo); assert.equal(alterada.status, 1); assert.match(alterada.stdout, /Fontes da instalação mudaram/);
  const link = path.join(pasta, 'link.md'); fs.symlinkSync(fato, link); c.respostas[0].fonte = link; salvar();
  assert.equal(rodar('--preparar-revisao', arquivo).status, 2);
  const hard = path.join(pasta, 'hard.md'); fs.linkSync(fato, hard); c.respostas[0].fonte = hard; salvar();
  assert.equal(rodar('--preparar-revisao', arquivo).status, 2);
});
