import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { executarNavegador, prepararComando, limparAmbiente } from '../src/navegador.js';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/testes-navegador');
fs.mkdirSync(base, { recursive: true });
function fixture(t, { modo = 'chrome_assistido', codigos = [] } = {}) {
  const raiz = fs.mkdtempSync(path.join(base, 'fixture-'));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  for (const dir of ['config', 'data', 'node_modules/agent-browser/bin']) fs.mkdirSync(path.join(raiz, dir), { recursive: true });
  const chrome = path.join(raiz, 'chrome-ficticio'); fs.writeFileSync(chrome, 'fixture; nunca executado');
  fs.writeFileSync(path.join(raiz, 'config/navegador.json'), JSON.stringify({ versao: 1, transportePadrao: 'headless', agentBrowserVersion: '0.42.0', executavelChrome: chrome, portaAcessoHumano: 4849 }));
  fs.writeFileSync(path.join(raiz, 'node_modules/agent-browser/package.json'), '{"version":"0.42.0"}');
  fs.writeFileSync(path.join(raiz, 'data/politica-autonomia.json'), JSON.stringify({ modoCandidatura: modo }));
  const chamadas = [];
  const executar = (bin, args) => ({ status: 0, stdout: bin === process.execPath ? 'agent-browser 0.42.0' : 'Chrome for Testing 157.0.0.0', stderr: '' });
  const iniciar = (bin, args, opts) => { chamadas.push({ bin, args, opts }); const filho = new EventEmitter(); queueMicrotask(() => filho.emit('exit', codigos.shift() ?? 0, null)); return filho; };
  return { raiz, chamadas, opcoes: { raiz, executar, iniciar, conferirOnboarding() {} }, acesso: path.join(raiz, 'data/navegador/acesso-humano.json') };
}

test('diagnóstico confirma versão e perfil sem abrir browser nem gerar registro humano', async t => {
  const f = fixture(t); const r = await executarNavegador(['diagnostico'], f.opcoes);
  assert.equal(r.transportePadrao, 'headless'); assert.equal(r.acessoHumano, false);
  assert.equal(f.chamadas.length, 0);
  assert.ok(r.perfil.startsWith(f.raiz));
  assert.equal(fs.existsSync(path.join(f.raiz, 'data/onboarding-humano.json')), false);
});

test('login mantém perfil/sessão, abre aba nova e entrega dashboard loopback ao humano', async t => {
  const f = fixture(t); const r = await executarNavegador(['login', 'linkedin'], f.opcoes);
  assert.equal(r.estado, 'aguardando_pessoa'); assert.equal(r.urlAcessoHumano, 'http://localhost:4849');
  assert.equal(f.chamadas.length, 2);
  assert.deepEqual(f.chamadas[0].args.slice(-3), ['tab', 'new', 'https://www.linkedin.com/login']);
  assert.deepEqual(f.chamadas[1].args.slice(-4), ['dashboard', 'start', '--port', '4849']);
  for (const c of f.chamadas) {
    assert.ok(c.args.includes('--profile')); assert.ok(c.args.includes('--no-auto-connect'));
    assert.equal(c.args[c.args.indexOf('--session') + 1], 'jobrelay');
    assert.equal(c.opts.shell, false);
    assert.equal(c.args.includes('--headed'), false);
  }
  assert.equal(JSON.parse(fs.readFileSync(f.acesso)).ativo, true);
  assert.equal(fs.existsSync(path.join(f.raiz, 'data/onboarding-humano.json')), false);
});

test('handoff bloqueia todas as leituras e ações do agente, inclusive fechamento e nova navegação', async t => {
  const f = fixture(t); await executarNavegador(['login', 'gupy'], f.opcoes);
  assert.deepEqual(f.chamadas[0].args.slice(-3), ['tab', 'new', 'https://login.gupy.io/candidate']);
  const total = f.chamadas.length;
  for (const args of [['snapshot', '-i'], ['open', 'https://example.org'], ['close'], ['fill', '#senha', 'nao-usado'], ['login', 'linkedin']]) {
    await assert.rejects(executarNavegador(args, f.opcoes), /ACESSO_HUMANO_ATIVO/);
  }
  assert.equal(f.chamadas.length, total);
});

test('retomar exige aviso humano explícito e não declara autenticação comprovada', async t => {
  const f = fixture(t); await executarNavegador(['login', 'linkedin'], f.opcoes);
  await assert.rejects(executarNavegador(['retomar'], f.opcoes), /Aguarde a pessoa/);
  const r = await executarNavegador(['retomar', '--confirmado-pela-pessoa'], f.opcoes);
  assert.equal(r.estado, 'retomado'); assert.match(r.autenticacao, /Não comprovada/);
  assert.equal(JSON.parse(fs.readFileSync(f.acesso)).ativo, false);
  assert.deepEqual(f.chamadas.at(-1).args.slice(-2), ['snapshot', '-i']);
});

test('falha do dashboard conserva posse humana e sessão, sem close/fallback', async t => {
  const f = fixture(t, { codigos: [0, 1] });
  const r = await executarNavegador(['login', 'linkedin'], f.opcoes);
  assert.equal(r.codigo, 1); assert.equal(r.estado, 'aguardando_pessoa');
  assert.equal(JSON.parse(fs.readFileSync(f.acesso)).ativo, true);
  assert.ok(f.chamadas.every(c => !c.args.includes('close')));
});

test('falha de snapshot na retomada não libera o agente', async t => {
  const f = fixture(t, { codigos: [0, 0, 1] }); await executarNavegador(['login', 'gupy'], f.opcoes);
  const r = await executarNavegador(['retomar', '--confirmado-pela-pessoa'], f.opcoes);
  assert.equal(r.codigo, 1); assert.equal(JSON.parse(fs.readFileSync(f.acesso)).ativo, true);
});

test('login é recusado antes de onboarding; não gera recibo humano nem abre portal', async t => {
  const f = fixture(t); delete f.opcoes.conferirOnboarding;
  await assert.rejects(executarNavegador(['login', 'linkedin'], f.opcoes), /ONBOARDING_HUMANO_OBRIGATORIO/);
  assert.equal(f.chamadas.length, 0);
});

test('mapear bloqueia escrita e wrapper recusa cookies, eval, CDP, headed e endpoints arbitrários de login', async t => {
  const f = fixture(t, { modo: 'mapear' });
  assert.throws(() => prepararComando(['fill', '#nome', 'Fictício'], f.opcoes), /MODO_MAPEAMENTO/);
  for (const args of [['eval', '1'], ['cookies'], ['open', 'https://example.org', '--cdp'], ['open', 'https://example.org', '--headed']]) {
    assert.throws(() => prepararComando(args, f.opcoes), /não permitid/);
  }
  await assert.rejects(executarNavegador(['login', 'https://example.org'], f.opcoes), /login linkedin ou login gupy/);
});

test('ambiente não herda serviços remotos, proxies, token de dashboard ou chaves de chat', () => {
  const env = limparAmbiente({ PATH: '/usr/bin', AGENT_BROWSER_DASHBOARD_ALLOWED_ORIGINS: 'https://remote.example', AGENT_BROWSER_CDP: 'x', BROWSERBASE_API_KEY: 'x', HTTPS_PROXY: 'x', AI_GATEWAY_API_KEY: 'x', OPENAI_API_KEY: 'x' });
  assert.deepEqual(env, { PATH: '/usr/bin' });
});

test('lock impede comando simultâneo e não é tomado por timeout', async t => {
  const f = fixture(t); prepararComando(['diagnostico'], f.opcoes);
  fs.writeFileSync(path.join(f.raiz, 'data/navegador/.comando.lock'), 'ocupado');
  await assert.rejects(executarNavegador(['open', 'https://example.org'], f.opcoes), /NAVEGADOR_OCUPADO/);
  assert.equal(f.chamadas.length, 0);
});

test('posse de comando dura até o subprocesso terminar', async t => {
  const f = fixture(t); const filho = new EventEmitter();
  const primeiro = executarNavegador(['open', 'https://example.org'], { ...f.opcoes, iniciar: () => filho });
  await assert.rejects(executarNavegador(['snapshot', '-i'], f.opcoes), /NAVEGADOR_OCUPADO/);
  filho.emit('exit', 0, null); assert.equal((await primeiro).codigo, 0);
  const segundo = await executarNavegador(['snapshot', '-i'], f.opcoes);
  assert.equal(segundo.codigo, 0);
});
