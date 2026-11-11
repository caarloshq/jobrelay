import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('instalação sintética salva DOCX, rejeita ausência de CV e conclui Notion sem ID', async (t) => {
  const base = path.join(repo, 'vagas/data');
  fs.mkdirSync(base, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(base, 'teste-onboarding-http-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  for (const dir of ['vagas/src', 'vagas/scripts', 'onboarding']) fs.cpSync(path.join(repo, dir), path.join(fixture, dir), { recursive: true });
  for (const dir of ['vagas/config', 'vagas/data', 'aplicacao', 'Skills/adapt-resume/materiais-fonte']) fs.mkdirSync(path.join(fixture, dir), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'package.json'), '{"type":"module"}');
  // Templates versionados neutros, nunca os dados que o humano preencheu.
  for (const nome of ['perfil.json', 'perfil-candidatura.json', 'linkedin.json', 'palavras-chave.json', 'dorks.json']) {
    const r = spawnSync('git', ['show', `HEAD:vagas/config/${nome}`], { cwd: repo });
    assert.equal(r.status, 0); fs.writeFileSync(path.join(fixture, 'vagas/config', nome), r.stdout);
  }
  const perguntas = spawnSync('git', ['show', 'HEAD:vagas/data/perguntas.json'], { cwd: repo });
  assert.equal(perguntas.status, 0); fs.writeFileSync(path.join(fixture, 'vagas/data/perguntas.json'), perguntas.stdout);
  for (const nome of ['PERFIL.md', 'RESPOSTAS.md']) {
    const r = spawnSync('git', ['show', `HEAD:aplicacao/${nome}`], { cwd: repo });
    assert.equal(r.status, 0); fs.writeFileSync(path.join(fixture, 'aplicacao', nome), r.stdout);
  }
  const port = await new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });
  const proc = spawn(process.execPath, ['vagas/scripts/onboarding.mjs', '--abrir', '--sem-navegador'], { cwd: fixture, env: { ...process.env, ONBOARDING_PORTA: String(port), VAGAS_DIR_DADOS: path.join(fixture, 'vagas/data') }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (proc.exitCode === null) { const done = new Promise(r => proc.once('exit', r)); proc.kill(); await done; } });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor sintético não iniciou')), 15000);
    proc.stdout.on('data', c => { if (c.toString().includes('Formulário de onboarding')) { clearTimeout(timeout); resolve(); } });
    proc.once('exit', code => { clearTimeout(timeout); reject(new Error(`Servidor terminou: ${code}`)); });
  });
  const origin = `http://localhost:${port}`;
  const html = await (await fetch(origin)).text();
  assert.match(html, /data-passo="0"/); assert.match(html, /data-passo="9"/);
  assert.doesNotMatch(html, /id="profissao"|id="database-id"/);
  const token = html.match(/name="onboarding-sessao" content="([^"]+)"/)[1];
  const post = async (passo, dados) => { const response = await fetch(`${origin}/api/salvar`, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-onboarding-sessao': token }, body: JSON.stringify({ passo, dados }) }); if (response.status !== 200 && passo !== 3) console.error(passo, await response.clone().text()); return response; };
  assert.equal((await post(1, { nome: 'Pessoa Fictícia', cargo_alvo: 'Engenheira de Dados', pais: 'Brazil' })).status, 200);
  assert.equal((await post(2, { foco: 'nacional' })).status, 200);
  const vazio = await post(3, { arquivos: [] }); assert.equal(vazio.status, 422); assert.match((await vazio.json()).erro, /currículo/);
  const zip = spawnSync('python3', ['-c', `import io,zipfile,sys
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z: z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Material fictício para teste</w:t></w:r></w:p></w:body></w:document>')
sys.stdout.buffer.write(b.getvalue())`]);
  assert.equal((await post(3, { arquivos: [{ tipo: 'curriculo', nome: 'cv.docx', base64: zip.stdout.toString('base64') }] })).status, 200);
  assert.match(fs.readFileSync(path.join(fixture, 'Skills/adapt-resume/materiais-fonte/curriculo.extraido.txt'), 'utf8'), /Material fictício/);
  const dirMateriais = path.join(fixture, 'Skills/adapt-resume/materiais-fonte');
  const antes = fs.readFileSync(path.join(dirMateriais, 'curriculo.extraido.txt'), 'utf8');
  const pdfInvalido = await post(3, { arquivos: [{ tipo: 'curriculo', nome: 'cv.pdf', base64: Buffer.from('%PDF-1.7\ncorrompido').toString('base64') }] });
  assert.equal(pdfInvalido.status, 400);
  assert.match((await pdfInvalido.json()).erro, /Não foi possível ler o PDF/);
  assert.equal(fs.readFileSync(path.join(dirMateriais, 'curriculo.extraido.txt'), 'utf8'), antes);
  assert.equal(fs.existsSync(path.join(dirMateriais, 'curriculo.pdf')), false);
  assert.equal((await post(3, { arquivos: [{ tipo: 'adicional', nome: 'antigo.txt', base64: Buffer.from('Texto antigo').toString('base64') }] })).status, 200);
  assert.equal((await post(3, { arquivos: [{ tipo: 'adicional', nome: 'novo.docx', base64: zip.stdout.toString('base64') }] })).status, 200);
  assert.equal(fs.existsSync(path.join(dirMateriais, 'adicional.txt')), false);
  assert.ok(fs.readdirSync(path.join(dirMateriais, '.historico')).some(pasta =>
    fs.readFileSync(path.join(dirMateriais, '.historico', pasta, 'adicional.txt'), 'utf8') === 'Texto antigo'));
  const reextracao = spawnSync(process.execPath, ['vagas/scripts/onboarding.mjs', '--extrair'], { cwd: fixture, env: { ...process.env, VAGAS_DIR_DADOS: path.join(fixture, 'vagas/data') } });
  assert.equal(reextracao.status, 0);
  assert.match(fs.readFileSync(path.join(dirMateriais, 'adicional.extraido.txt'), 'utf8'), /Material fictício/);
  assert.doesNotMatch(fs.readFileSync(path.join(dirMateriais, 'adicional.extraido.txt'), 'utf8'), /Texto antigo/);
  assert.equal((await post(4, { niveis_aceitos: ['senior'] })).status, 200);
  assert.equal((await post(5, { minimo_mensal_brl: 8000, referencia_atual_brl: 10000, aceita_remoto: true })).status, 200);
  assert.equal((await post(6, { fonteEstado: 'notion', modoCandidatura: 'mapear', autonomia: false, atualizarAutomaticamente: false })).status, 200);
  assert.equal((await post(7, { token: null })).status, 200);
  const resultado = await fetch(`${origin}/api/confirmar`, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-onboarding-sessao': token }, body: JSON.stringify({ confirmadoPelaPessoa: true }) });
  assert.equal(resultado.status, 200);
  const state = (await resultado.json()).estado;
  assert.equal(state.fonteEstado.pendenteCriacao, true);
  assert.equal(state.politica.atualizarAutomaticamente, false);
  assert.equal(state.materiais.length, 2);
  assert.equal(state.perfil.profissao, 'Engenheira de Dados');
  assert.match(state.instrucao, /modelo-notion/);
});
