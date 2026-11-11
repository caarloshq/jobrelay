import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('HTTP do quadro bloqueia CSRF e texto simples, preservando navegador local e proxy Node JSON', async t => {
  const fixture = fs.mkdtempSync(path.join(repo, 'vagas/data/teste-quadro-http-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  for (const dir of ['vagas/src', 'vagas/scripts']) fs.cpSync(path.join(repo, dir), path.join(fixture, dir), { recursive: true });
  for (const dir of ['vagas/config', 'vagas/data']) fs.mkdirSync(path.join(fixture, dir), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'package.json'), '{"type":"module"}');
  for (const nome of ['perfil.json', 'palavras-chave.json', 'dorks.json', 'linkedin.json']) {
    const blob = spawnSync('git', ['show', `HEAD:vagas/config/${nome}`], { cwd: repo });
    assert.equal(blob.status, 0);
    fs.writeFileSync(path.join(fixture, 'vagas/config', nome), blob.stdout);
  }
  const arquivo = path.join(fixture, 'vagas/data/quadro.json');
  fs.writeFileSync(arquivo, JSON.stringify({ versao: 2, vagas: { 'ficticio:1': { titulo: 'Exemplo', empresa: 'Empresa fictícia', status: 'Avaliar', historico: [] } } }));
  const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
  const proc = spawn(process.execPath, ['vagas/scripts/quadro.mjs', '--sem-navegador'], { cwd: fixture, env: { PATH: process.env.PATH || '', QUADRO_PORTA: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (proc.exitCode === null) { const done = new Promise(resolve => proc.once('exit', resolve)); proc.kill(); await done; } });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor do quadro não iniciou')), 10000);
    proc.stdout.on('data', data => { if (data.toString().includes('Quadro em')) { clearTimeout(timeout); resolve(); } });
    proc.once('exit', () => { clearTimeout(timeout); reject(new Error('Servidor do quadro encerrou antes de iniciar')); });
  });
  const origin = `http://127.0.0.1:${port}`;
  const post = headers => fetch(`${origin}/api/status`, { method: 'POST', headers, body: JSON.stringify({ id: 'ficticio:1', status: 'Aplicar' }) });
  const antes = fs.readFileSync(arquivo, 'utf8');
  for (const headers of [
    { origin: 'https://example.com', 'content-type': 'application/json' },
    { origin: 'null', 'content-type': 'application/json' },
    { origin: `http://127.0.0.1:${port + 1}`, 'content-type': 'application/json' },
  ]) assert.equal((await post(headers)).status, 403);
  for (const headers of [{ 'content-type': 'text/plain' }, { origin, 'content-type': 'text/plain' }, {}]) {
    assert.equal((await post(headers)).status, 415);
  }
  assert.equal(fs.readFileSync(arquivo, 'utf8'), antes);
  assert.equal((await post({ origin, 'content-type': 'application/json; charset=utf-8' })).status, 200);
  assert.equal(JSON.parse(fs.readFileSync(arquivo, 'utf8')).vagas['ficticio:1'].status, 'Aplicar');
  assert.equal((await post({ 'content-type': 'application/json' })).status, 200);
});
