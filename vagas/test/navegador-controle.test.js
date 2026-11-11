import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { prepararComando, limparAmbiente, detectarChrome, LEITURA_CAMPOS } from '../src/navegador.js';
import { endpointDoPerfil, executarProtegido, urlCheckpoint, inventarioSeguro, lifecycleSeguro, processosDaInstalacao, argumentosSemLancamento } from '../src/navegador-controle.js';

const raizVagas = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testes = path.join(raizVagas, 'data', 'testes-navegador-controle');
fs.mkdirSync(testes, { recursive: true, mode: 0o700 });
function fixture(t, modo = 'chrome_assistido') {
  const raiz = fs.mkdtempSync(path.join(testes, 'caso-'));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  for (const dir of ['config', 'data', 'node_modules/agent-browser/bin']) fs.mkdirSync(path.join(raiz, dir), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'config/navegador.json'), JSON.stringify({ versao: 1, transportePadrao: 'headless', agentBrowserVersion: '0.42.0', executavelChrome: null, portaAcessoHumano: 4849 }));
  fs.writeFileSync(path.join(raiz, 'data/politica-autonomia.json'), JSON.stringify({ modoCandidatura: modo }));
  fs.writeFileSync(path.join(raiz, 'node_modules/agent-browser/package.json'), '{"version":"0.42.0"}');
  const chrome = path.join(raiz, 'chrome-teste'); fs.writeFileSync(chrome, '', { mode: 0o700 });
  const executar = (exe, args) => ({ status: 0, stdout: exe === chrome ? 'Google Chrome 157.0.8103.40\n' : 'agent-browser 0.42.0\n', stderr: '' });
  const ambiente = { PATH: process.env.PATH, JOBRELAY_CHROME_EXECUTAVEL: chrome, AGENT_BROWSER_CDP: '9222', AGENT_BROWSER_PROFILE: '/perfil-pessoal', AGENT_BROWSER_PROVIDER: 'browserbase', AGENT_BROWSER_ARGS: '--proxy-server=evil', HTTPS_PROXY: 'http://proxy' };
  return { raiz, ambiente, executar, chrome };
}

test('spawn usa somente perfil próprio, configuração explícita e ambiente isolado', t => {
  const f = fixture(t); const p = prepararComando(['open', 'https://example.test'], f);
  assert.equal(p.comando, process.execPath); assert.equal(p.opcoes.shell, false); assert.equal(p.opcoes.cwd, f.raiz);
  assert.ok(p.args.includes('--no-auto-connect')); assert.ok(p.args.includes('--no-auto-dialog'));
  assert.equal(p.args[p.args.indexOf('--profile') + 1], path.join(f.raiz, 'data/navegador/perfil'));
  assert.equal(p.args[p.args.indexOf('--executable-path') + 1], f.chrome);
  assert.equal(p.opcoes.env.AGENT_BROWSER_CDP, undefined); assert.equal(p.opcoes.env.AGENT_BROWSER_PROFILE, undefined);
  assert.equal(p.opcoes.env.AGENT_BROWSER_PROVIDER, undefined); assert.equal(p.opcoes.env.HTTPS_PROXY, undefined);
  assert.equal(p.opcoes.env.AGENT_BROWSER_SOCKET_DIR, 'data/navegador/s');
  assert.equal(p.opcoes.env.AGENT_BROWSER_IDLE_TIMEOUT_MS, '0');
  assert.equal(p.args[p.args.indexOf('--idle-timeout') + 1], '0');
  assert.ok(p.opcoes.env.TMPDIR.startsWith(f.raiz));
  for (const d of ['', 'perfil', 's', 'tmp', 'downloads', 'capturas']) assert.equal(fs.statSync(path.join(f.raiz, 'data/navegador', d)).mode & 0o777, 0o700);
});

test('mapeamento e política ausente recusam ações de escrita sem alterar a política', t => {
  const f = fixture(t, 'mapear'); const politica = path.join(f.raiz, 'data/politica-autonomia.json'); const antes = fs.readFileSync(politica);
  for (const args of [['fill', '@e1', 'texto'], ['click', '@e1'], ['press', 'Enter'], ['upload', '@e2', 'arquivo.pdf']]) assert.throws(() => prepararComando(args, f), /MODO_MAPEAMENTO/);
  assert.deepEqual(fs.readFileSync(politica), antes);
  assert.ok(prepararComando(['snapshot', '-i'], f).args.includes('snapshot'));
  fs.unlinkSync(politica); assert.throws(() => prepararComando(['type', '@e1', 'texto'], f), /MODO_MAPEAMENTO/);
});

test('recusa JavaScript, batch, estado, perfil, provedores e flags globais em qualquer posição', t => {
  const f = fixture(t);
  for (const args of [
    ['eval', 'document.body.remove()'], ['wait', '--fn', 'fetch("https://evil")'], ['batch', 'open https://evil'],
    ['open', 'https://example.test', '--profile=/pessoal'], ['snapshot', '--cdp', '9222'],
    ['fill', '@e1', '--config=/tmp/evil'], ['tab', 'new', '-p', 'browserbase'],
    ['snapshot', '--init-script', 'evil.js'], ['snapshot', '--auto-connect'], ['open', '--engine', 'obscura'],
    ['wait', '--state', '/cookies.json'], ['wait', '@e1', '--state', '/cookies.json'], ['get', 'cdp-url'],
    ['open', 'javascript:alert(1)'], ['open', 'file:///etc/passwd'],
  ]) assert.throws(() => prepararComando(args, f), undefined, JSON.stringify(args));
});

test('Chrome explícito inválido não faz fallback e --version é executado sem shell', t => {
  const f = fixture(t); let chamadas = 0;
  assert.throws(() => detectarChrome({ executavelChrome: null, portaAcessoHumano: 4849 }, { ambiente: f.ambiente, executar(exe, args, opts) { chamadas++; assert.equal(opts.shell, false); assert.deepEqual(args, ['--version']); return { status: 1 }; } }), /não passou/);
  assert.equal(chamadas, 1);
});

test('runtime não segue links e não sobrescreve configuração alterada', t => {
  const f = fixture(t); const runtime = path.join(f.raiz, 'data/navegador');
  fs.symlinkSync(path.join(f.raiz, 'config'), runtime, 'dir');
  assert.throws(() => prepararComando(['snapshot'], f), /sem links/); fs.unlinkSync(runtime);
  prepararComando(['snapshot'], f);
  const cfg = path.join(runtime, 'config-confiavel.json'); fs.writeFileSync(cfg, '{"profile":"privado"}');
  assert.throws(() => prepararComando(['snapshot'], f), /mudou/);
  assert.equal(fs.readFileSync(cfg, 'utf8'), '{"profile":"privado"}');
});

test('campos usa somente leitura fixa e preserva argumentos pessoais como dados', t => {
  const f = fixture(t); const p = prepararComando(['campos'], f);
  assert.deepEqual(p.args.slice(-2), ['eval', LEITURA_CAMPOS]);
  const valor = 'Texto com $(não executar); e "aspas"';
  const fill = prepararComando(['fill', '@e2', valor], f);
  assert.deepEqual(fill.args.slice(-3), ['fill', '@e2', valor]); assert.equal(fill.opcoes.shell, false);
});

test('inspeção de campos omite valores e não inventa vazio para widget sem value', () => {
  const base = { id: 'campo', name: 'campo', labels: [], offsetWidth: 100, offsetHeight: 20, getClientRects: () => [1], getAttribute: nome => nome === 'role' ? 'combobox' : null };
  const privado = { ...base, type: 'text', value: 'sentinela-privada-nao-exportar' };
  const personalizado = { ...base };
  const document = { querySelectorAll: seletor => seletor.startsWith('input') ? [privado, personalizado] : [] };
  const texto = runInNewContext(LEITURA_CAMPOS, { document, location: { origin: 'https://example.test', pathname: '/form' } });
  const resultado = JSON.parse(texto);
  assert.equal(resultado.campos[0].vazio, false);
  assert.equal(resultado.campos[1].vazio, null);
  assert.ok(!texto.includes('sentinela-privada-nao-exportar'));
});

test('upload limita leitura ao projeto e screenshot limita gravação à pasta privada', t => {
  const f = fixture(t); const pdf = path.join(f.raiz, 'teste.pdf'); fs.writeFileSync(pdf, '%PDF-teste');
  const upload = prepararComando(['upload', '@e1', 'teste.pdf'], f); assert.equal(upload.args.at(-1), pdf);
  assert.throws(() => prepararComando(['upload', '@e1', '/etc/passwd'], f), /dentro deste projeto/);
  assert.throws(() => prepararComando(['screenshot', '../fora.png'], f), /sem diretórios/);
  const captura = prepararComando(['screenshot', 'teste.png', '--full'], f);
  assert.ok(captura.args.at(-2).endsWith('data/navegador/capturas/teste.png'));
  const destino = path.join(f.raiz, 'data/navegador/capturas/vinculo.png');
  fs.linkSync(pdf, destino);
  assert.throws(() => prepararComando(['screenshot', 'vinculo.png'], f), /já existe/);
  assert.equal(fs.readFileSync(pdf, 'utf8'), '%PDF-teste');
  const regular = path.join(f.raiz, 'data/navegador/capturas/existente.png');
  fs.writeFileSync(regular, 'preservar');
  assert.throws(() => prepararComando(['screenshot', 'existente.png'], f), /já existe/);
  assert.equal(fs.readFileSync(regular, 'utf8'), 'preservar');
});

test('diagnóstico confere versões mas não devolve um plano de abertura de browser', t => {
  const f = fixture(t); const p = prepararComando(['diagnostico'], f);
  assert.equal(p.diagnostico.autorizaEnvio, false); assert.equal(p.diagnostico.escritaPermitidaPelaPolitica, true);
  assert.equal(p.comando, undefined); assert.equal(p.diagnostico.agentBrowser, 'agent-browser 0.42.0');
  const clean = limparAmbiente({ HOME: '/normal', AGENT_BROWSER_CONFIG: '/evil', PATH: '/bin' });
  assert.deepEqual(clean, { HOME: '/normal', PATH: '/bin' });
});

test('entrada JSON é validada sem ecoar conteúdo pessoal ou executar flags recebidas', () => {
  const script = path.join(raizVagas, 'scripts/navegador.mjs');
  for (const input of ['{"privado":"sentinela-nao-imprimir"', JSON.stringify(['fill', '@e1', '--profile=sentinela-nao-imprimir'])]) {
    const r = spawnSync(process.execPath, [script, '--stdin-json'], { input, encoding: 'utf8', timeout: 10000 });
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.ok(!r.stderr.includes('sentinela-nao-imprimir'));
  }
});

function controleFixture(t, comando = ['fill', '@e1', 'sentinela-valor-pessoal']) {
  const f = fixture(t); const plano = prepararComando(comando, f);
  plano.controle = { runtime: path.join(f.raiz, 'data/navegador'), perfil: path.join(f.raiz, 'data/navegador/perfil'),
    confiavel: path.join(f.raiz, 'data/navegador/config-confiavel.json'), inicioComando: plano.args.length - comando.length };
  let pids = { daemonPid: 100, chromePid: 200 }; const acoes = []; const leituras = [];
  const deps = { processos: () => ({ ...pids }), agora: () => '2026-11-11T18:00:00.000Z',
    executar(exe, args) { leituras.push(args); assert.deepEqual(args.slice(-2), ['get', 'cdp-url']);
      assert.ok(!args.includes('--profile')); assert.ok(!args.includes('--no-auto-connect'));
      return { status: 0, stdout: JSON.stringify({ success: true, data: { url: 'ws://127.0.0.1:9000/devtools/browser/teste' } }) }; },
    targets: async () => [{ type: 'page', targetId: 'aba-1', url: 'https://localiza.gupy.io/candidates/applications/123/steps/456/curriculum?token=sentinela-token#privado', title: 'sentinela-titulo-pessoal' }],
    executarAcao: async (p, args) => { acoes.push(args); return { codigo: 0, lifecycle: { reused: true } }; } };
  return { ...f, plano, comando, deps, acoes, leituras, mudarPid: n => { pids = n; }, dir: path.join(plano.controle.runtime, 'controle') };
}

test('sessão ativa recebe ação uma vez sem opções de lançamento; checkpoint não salva valores de formulário', async t => {
  const f = controleFixture(t); const r = await executarProtegido(f.plano, f.comando, f.deps);
  assert.equal(r.codigo, 0); assert.equal(f.acoes.length, 1); assert.equal(f.leituras.length, 2);
  for (const flag of ['--profile', '--executable-path', '--download-path', '--no-auto-connect']) assert.ok(!f.acoes[0].includes(flag));
  assert.ok(f.acoes[0].includes('sentinela-valor-pessoal'));
  const checkpoint = JSON.parse(fs.readFileSync(path.join(f.dir, 'checkpoint.json')));
  assert.equal(checkpoint.tabs[0].url, 'https://localiza.gupy.io/candidates/applications/123/steps/456/curriculum');
  assert.equal(checkpoint.tabs[0].etapa, 'curriculum'); assert.equal(checkpoint.abasProtegidas, true);
  for (const nome of ['checkpoint.json', 'checkpoints.jsonl', 'eventos.jsonl']) {
    const file = path.join(f.dir, nome); const texto = fs.readFileSync(file, 'utf8');
    assert.ok(!texto.includes('sentinela')); assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  }
});

test('PID trocado bloqueia antes da ação e reconciliação explícita só inventaria, sem reiniciar', async t => {
  const f = controleFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
  f.mudarPid({ daemonPid: 100, chromePid: 201 });
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_PID_ALTERADO/);
  assert.equal(f.acoes.length, 1); assert.equal(f.leituras.length, 2);
  const r = await executarProtegido(f.plano, ['reconciliar'], f.deps);
  assert.equal(r.reiniciou, false); assert.equal(r.restaurouRascunhos, false); assert.equal(f.acoes.length, 1);
  await executarProtegido(f.plano, f.comando, f.deps); assert.equal(f.acoes.length, 2);
  const linhas = fs.readFileSync(path.join(f.dir, 'checkpoints.jsonl'), 'utf8');
  assert.ok(linhas.includes('"chromePid":200')); assert.ok(linhas.includes('"chromePid":201'));
});

test('mudança de configuração com abas abertas não relança o browser', async t => {
  const f = controleFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
  f.plano.args[f.plano.args.indexOf('--profile') + 1] += '-diferente';
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_OPCOES_ALTERADAS/);
  assert.equal(f.acoes.length, 1);
});

test('falha de CDP antes de ação não faz retry nem substitui último checkpoint', async t => {
  const f = controleFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
  const antes = fs.readFileSync(path.join(f.dir, 'checkpoint.json'));
  f.deps.executar = () => ({ status: 1, stderr: 'sentinela-segredo CDP response channel closed' });
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_CDP_INDISPONIVEL/);
  assert.equal(f.acoes.length, 1); assert.deepEqual(fs.readFileSync(path.join(f.dir, 'checkpoint.json')), antes);
  assert.ok(!fs.readFileSync(path.join(f.dir, 'eventos.jsonl'), 'utf8').includes('sentinela'));
});

test('PID muda durante ação: preserva checkpoint anterior, suspende próximas ações e não consulta daemon novamente', async t => {
  const f = controleFixture(t);
  f.deps.executarAcao = async () => { f.mudarPid({ daemonPid: 100, chromePid: 202 }); return { codigo: 0, lifecycle: { relaunchedBrowser: true } }; };
  const r = await executarProtegido(f.plano, f.comando, f.deps);
  assert.equal(r.codigo, 1); assert.equal(f.leituras.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'checkpoint.json'))).chromePid, 200);
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_RECONCILIACAO_PENDENTE/);
});

test('browser desaparecido com checkpoint não inicia outra instância; sessão nova só abre por ação explícita', async t => {
  const f = controleFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
  f.mudarPid({ daemonPid: 100, chromePid: null });
  await assert.rejects(executarProtegido(f.plano, ['open', 'https://example.test'], f.deps), /CONTROLE_BROWSER_AUSENTE/);
  assert.equal(f.acoes.length, 1);
  const g = controleFixture(t); g.mudarPid({ daemonPid: null, chromePid: null });
  await assert.rejects(executarProtegido(g.plano, g.comando, g.deps), /CONTROLE_BROWSER_AUSENTE/);
  assert.equal(g.acoes.length, 0);
  const h = controleFixture(t, ['open', 'https://example.test']); h.mudarPid({ daemonPid: null, chromePid: null });
  h.deps.executarAcao = async (p, args) => { h.acoes.push(args); h.mudarPid({ daemonPid: 100, chromePid: 200 }); return { codigo: 0, lifecycle: { launched: true } }; };
  await executarProtegido(h.plano, h.comando, h.deps); assert.equal(h.acoes.length, 1);
  assert.ok(h.acoes[0].includes('--profile'));
});

test('troca de daemon ou restartedBackground suspende antes de nova leitura mesmo com Chrome igual', async t => {
  for (const trocaPid of [true, false]) {
    const f = controleFixture(t);
    f.deps.executarAcao = async () => {
      if (trocaPid) f.mudarPid({ daemonPid: 101, chromePid: 200 });
      return { codigo: 0, lifecycle: trocaPid ? {} : { restartedBackground: true } };
    };
    const r = await executarProtegido(f.plano, f.comando, f.deps);
    assert.equal(r.codigo, 1); assert.equal(f.leituras.length, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'checkpoint.json'))).daemonPid, 100);
    await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_RECONCILIACAO_PENDENTE/);
  }
});

test('só reconciliar recupera trava de PID comprovadamente morto, sem tomar controlador vivo', async t => {
  const f = controleFixture(t); fs.mkdirSync(f.dir, { recursive: true });
  const lock = path.join(f.dir, 'controlador.lock'); fs.writeFileSync(lock, '999999');
  f.deps.pidVivo = () => false;
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_OCUPADO/);
  const r = await executarProtegido(f.plano, ['reconciliar'], f.deps);
  assert.equal(r.reiniciou, false); assert.equal(f.acoes.length, 0); assert.ok(!fs.existsSync(lock));
  assert.ok(fs.readFileSync(path.join(f.dir, 'eventos.jsonl'), 'utf8').includes('trava_orfa_recuperada'));
  fs.writeFileSync(lock, '123'); f.deps.pidVivo = () => true;
  await assert.rejects(executarProtegido(f.plano, ['reconciliar'], f.deps), /CONTROLE_OCUPADO/);
  assert.equal(fs.readFileSync(lock, 'utf8'), '123'); assert.ok(!fs.existsSync(path.join(f.dir, 'recuperacao.lock')));
});

test('close deliberado preserva histórico e permite open explícito sem apagar checkpoint', async t => {
  const f = controleFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
  f.deps.executarAcao = async (p, args) => { f.acoes.push(args); f.mudarPid({ daemonPid: null, chromePid: null }); return { codigo: 0, lifecycle: {} }; };
  const fechar = await executarProtegido(f.plano, ['close'], f.deps); assert.equal(fechar.codigo, 0);
  const cp = JSON.parse(fs.readFileSync(path.join(f.dir, 'checkpoint.json'))); assert.equal(cp.encerradaDeliberadamente, true);
  const reconhecido = await executarProtegido(f.plano, ['reconciliar'], f.deps); assert.equal(reconhecido.controle, 'encerrada');
  const abrir = ['open', 'https://example.test']; const plano = prepararComando(abrir, f);
  plano.controle = { ...f.plano.controle, inicioComando: plano.args.length - abrir.length };
  f.deps.executarAcao = async (p, args) => { f.acoes.push(args); f.mudarPid({ daemonPid: 102, chromePid: 202 }); return { codigo: 0, lifecycle: { launched: true } }; };
  const aberto = await executarProtegido(plano, abrir, f.deps); assert.equal(aberto.codigo, 0);
  assert.ok(f.acoes.at(-1).includes('--profile')); assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'checkpoint.json'))).chromePid, 202);
  const historico = fs.readFileSync(path.join(f.dir, 'checkpoints.jsonl'), 'utf8'); assert.ok(historico.includes('"chromePid":200')); assert.ok(historico.includes('"encerradaDeliberadamente":true'));
});

test('trava concorrente e registro inválido falham fechados sem deixar a própria trava pendurada', async t => {
  const f = controleFixture(t); fs.mkdirSync(f.dir, { recursive: true });
  fs.writeFileSync(path.join(f.dir, 'controlador.lock'), 'outro-controlador');
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_OCUPADO/);
  fs.unlinkSync(path.join(f.dir, 'controlador.lock')); fs.writeFileSync(path.join(f.dir, 'checkpoint.json'), 'JSON inválido');
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_REGISTRO_INVALIDO/);
  assert.ok(!fs.existsSync(path.join(f.dir, 'controlador.lock')));
});

test('checkpoint rejeita credenciais/query/hash e campos alheios; lifecycle não copia settings sensíveis', () => {
  assert.equal(urlCheckpoint('https://jobs.ashbyhq.com/empresa/job-id/apply?token=segredo#x'), 'https://jobs.ashbyhq.com/empresa/job-id/apply');
  assert.equal(urlCheckpoint('https://user:pass@localiza.gupy.io/qualquer'), 'https://localiza.gupy.io/[autenticacao]');
  assert.equal(urlCheckpoint('https://localiza.gupy.io/auth/callback/segredo'), 'https://localiza.gupy.io/[autenticacao]');
  assert.equal(urlCheckpoint('https://site-desconhecido.test/email-pessoal'), 'https://site-desconhecido.test/[rota-omitida]');
  assert.deepEqual(inventarioSeguro([{ type: 'service_worker', url: 'https://example.test' }]), []);
  const raw = '{"data":{"lifecycle":{"relaunchedBrowser":true,"effectiveLaunch":{"engine":"chrome","launchHash":18446744073709551615},"settings":{"changes":[{"name":"proxy","applied":true,"effect":"relaunch","from":"sentinela-1","to":"sentinela-2"}]}}}}';
  const out = lifecycleSeguro(raw, 'CDP response channel closed sentinela-3');
  assert.equal(out.launchHashDecimal, '18446744073709551615'); assert.equal(out.classeErro, 'canal_cdp');
  assert.ok(!JSON.stringify(out).includes('sentinela'));
});

test('inspeção de processos só retorna PIDs do perfil exato, sem argv ou outro Chrome pessoal', t => {
  const f = controleFixture(t); fs.writeFileSync(path.join(f.plano.controle.runtime, 's/jobrelay.pid'), '100');
  const perfil = f.plano.controle.perfil;
  const pids = processosDaInstalacao(f.plano, () => ({ status: 0, stdout: `100 1 daemon\n200 100 Chrome --user-data-dir=${perfil} --headless\n201 1 Chrome --user-data-dir=${perfil}2\n202 200 Chrome --type=renderer --user-data-dir=${perfil}\n` }));
  assert.deepEqual(pids, { daemonPid: 100, chromePid: 200 });
  assert.deepEqual(argumentosSemLancamento(['cli', '--profile', 'jobrelay', '--no-auto-connect', '--json', 'snapshot']), ['cli', '--json', 'snapshot']);
});


test('troca de daemon entre chamadas bloqueia antes de CDP e ação mesmo com Chrome igual', async t => {
  const f = controleFixture(t);
  await executarProtegido(f.plano, f.comando, f.deps);
  const leituras = f.leituras.length, acoes = f.acoes.length;
  f.mudarPid({ daemonPid: 101, chromePid: 200 });
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_PID_ALTERADO/);
  assert.equal(f.leituras.length, leituras); assert.equal(f.acoes.length, acoes);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'checkpoint.json'))).daemonPid, 100);
  const r = await executarProtegido(f.plano, ['reconciliar'], f.deps);
  assert.equal(r.controle, 'reconciliado');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'checkpoint.json'))).daemonPid, 101);
});


function reconexaoFixture(t) {
  const f = controleFixture(t, ['snapshot']);
  f.endpoint = 'ws://127.0.0.1:9000/devtools/browser/endpoint-sentinela';
  f.deps.endpointPerfil = () => f.endpoint;
  f.deps.processos = p => ({ chromePid: 200, daemonPid: p.controle.sessao ? 101 : 100 });
  return f;
}

test('reconectar anexa namespace separado ao mesmo Chrome e próximas chamadas usam só transporte novo', async t => {
  const f = reconexaoFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
  const n = f.acoes.length;
  let socketEnv; const acaoOriginal = f.deps.executarAcao;
  f.deps.executarAcao = async (plano, args, deps) => { socketEnv = plano.opcoes.env.AGENT_BROWSER_SOCKET_DIR; return acaoOriginal(plano, args, deps); };
  const r = await executarProtegido(f.plano, ['reconectar'], f.deps);
  assert.equal(socketEnv, 'data/navegador/r');
  assert.equal(path.isAbsolute(socketEnv), false);
  assert.ok(Buffer.byteLength(`${socketEnv}/recuperacao-12345678-1234-1234-1234-123456789012.sock`) < 100);
  assert.equal(r.controle, 'reconectado'); assert.equal(f.acoes.length, n + 1);
  const args = f.acoes.at(-1);
  assert.deepEqual(args.slice(-2), ['connect', f.endpoint]);
  assert.match(args[args.indexOf('--session') + 1], /^recuperacao-/);
  for (const flag of ['--profile', '--executable-path', '--auto-connect', '--no-auto-connect', '--download-path']) assert.ok(!args.includes(flag));
  const meta = JSON.parse(fs.readFileSync(path.join(f.dir, 'transporte.json')));
  assert.equal(meta.chromePid, 200); assert.equal(meta.daemonPid, 101); assert.equal(meta.proprietarioDaemonPid, 100);
  await executarProtegido(f.plano, f.comando, f.deps);
  assert.equal(f.acoes.at(-1)[f.acoes.at(-1).indexOf('--session') + 1], meta.sessao);
  assert.deepEqual(f.acoes.at(-1).slice(-1), ['snapshot']);
  for (const nome of ['eventos.jsonl', 'checkpoint.json', 'transporte.json']) assert.ok(!fs.readFileSync(path.join(f.dir, nome), 'utf8').includes('endpoint-sentinela'));
  await assert.rejects(executarProtegido(f.plano, ['close'], f.deps), /CONTROLE_CLOSE_ANEXADO_RECUSADO/);
});

test('reconectar recusa aba perdida antes de connect sem substituir checkpoint', async t => {
  const f = reconexaoFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
  const antes = fs.readFileSync(path.join(f.dir, 'checkpoint.json'), 'utf8'), n = f.acoes.length;
  f.deps.targets = async () => [{ type: 'page', targetId: 'outra', url: 'about:blank' }];
  await assert.rejects(executarProtegido(f.plano, ['reconectar'], f.deps), /CONTROLE_RECONEXAO_ABAS_DIVERGENTES/);
  assert.equal(f.acoes.length, n); assert.equal(fs.readFileSync(path.join(f.dir, 'checkpoint.json'), 'utf8'), antes);
});

test('reconectar falho não tenta novamente nem promove transporte incerto', async t => {
  const f = reconexaoFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
  let chamadas = 0; f.deps.executarAcao = async () => { chamadas++; return { codigo: 1, lifecycle: { classeErro: 'canal_cdp' } }; };
  await assert.rejects(executarProtegido(f.plano, ['reconectar'], f.deps), /CONTROLE_RECONEXAO_FALHOU/);
  assert.equal(chamadas, 1); assert.equal(fs.existsSync(path.join(f.dir, 'transporte.json')), false);
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_RECONCILIACAO_PENDENTE/);
  assert.equal(chamadas, 1);
});

test('transporte anexado bloqueia Chrome/daemon/endpoint alterados antes de ação', async t => {
  for (const mudanca of ['chrome', 'daemon', 'endpoint']) {
    const f = reconexaoFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
    await executarProtegido(f.plano, ['reconectar'], f.deps); const n = f.acoes.length;
    if (mudanca === 'endpoint') f.endpoint += '-mudou';
    else f.deps.processos = () => ({ chromePid: mudanca === 'chrome' ? 201 : 200, daemonPid: mudanca === 'daemon' ? 102 : 101 });
    await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_(TRANSPORTE_PID_ALTERADO|PORTA_MUDOU)/);
    assert.equal(f.acoes.length, n);
  }
});

test('endpoint do perfil exige arquivo próprio, path estrito e listener loopback do PID exato', t => {
  const f = controleFixture(t); const port = path.join(f.plano.controle.perfil, 'DevToolsActivePort');
  fs.writeFileSync(port, '9000\n/devtools/browser/teste-endpoint\n');
  const run = (exe, args) => { assert.equal(exe, 'lsof'); assert.ok(args.includes('200')); return { status: 0, stdout: 'p200\nf99\nn127.0.0.1:9000\n' }; };
  assert.equal(endpointDoPerfil(f.plano, 200, run), 'ws://127.0.0.1:9000/devtools/browser/teste-endpoint');
  for (const stdout of ['p201\nn127.0.0.1:9000\n', 'p200\nn*:9000\n', 'p200\nn192.168.1.1:9000\n'])
    assert.throws(() => endpointDoPerfil(f.plano, 200, () => ({ status: 0, stdout })), /CONTROLE_LISTENER_NAO_LOCAL/);
  fs.writeFileSync(port, '9000\n/devtools/browser/teste?token=nao\n');
  assert.throws(() => endpointDoPerfil(f.plano, 200, run), /CONTROLE_PORTA_INVALIDA/);
  fs.unlinkSync(port); fs.symlinkSync(f.plano.controle.confiavel, port);
  assert.throws(() => endpointDoPerfil(f.plano, 200, run), /CONTROLE_ARQUIVO_INSEGURO/);
});


test('duas recuperações explícitas preservam proprietário, targets e metadados anteriores sem replay', async t => {
  const f = reconexaoFixture(t); const sessoes = new Map(); let proximoPid = 101;
  f.deps.processos = p => ({ chromePid: 200, daemonPid: p.controle.sessao ? sessoes.get(p.controle.sessao) || null : 100 });
  f.deps.executarAcao = async (p, args) => {
    f.acoes.push(args);
    if (args.at(-2) === 'connect') { assert.notEqual(p.controle.sessao, 'jobrelay'); sessoes.set(p.controle.sessao, proximoPid++); }
    return { codigo: 0, lifecycle: { reused: true } };
  };
  await executarProtegido(f.plano, f.comando, f.deps);
  const primeira = await executarProtegido(f.plano, ['reconectar'], f.deps);
  const meta1 = JSON.parse(fs.readFileSync(path.join(f.dir, 'transporte.json')));
  // Uma queda do attach anterior não autoriza replay e não impede reconexão explícita ao proprietário preservado.
  sessoes.delete(meta1.sessao);
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_TRANSPORTE_PID_ALTERADO/);
  const antes = f.acoes.length;
  const segunda = await executarProtegido(f.plano, ['reconectar'], f.deps);
  const meta2 = JSON.parse(fs.readFileSync(path.join(f.dir, 'transporte.json')));
  assert.notEqual(meta1.sessao, meta2.sessao); assert.equal(meta1.daemonPid, 101); assert.equal(meta2.daemonPid, 102);
  assert.equal(meta2.chromePid, 200); assert.equal(meta2.proprietarioDaemonPid, 100);
  assert.deepEqual(segunda.tabs, primeira.tabs); assert.equal(f.acoes.length, antes + 1);
  assert.deepEqual(f.acoes.at(-1).slice(-2), ['connect', f.endpoint]);
  const historico = fs.readFileSync(path.join(f.dir, 'transportes.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.ok(historico.some(m => m.sessao === meta1.sessao)); assert.ok(historico.some(m => m.sessao === meta2.sessao));
  assert.ok(!JSON.stringify(historico).includes('endpoint-sentinela'));
  await executarProtegido(f.plano, f.comando, f.deps);
  assert.equal(f.acoes.at(-1)[f.acoes.at(-1).indexOf('--session') + 1], meta2.sessao);
  f.deps.executarAcao = async () => ({ codigo: 1, lifecycle: { classeErro: 'canal_cdp' } });
  await assert.rejects(executarProtegido(f.plano, ['reconectar'], f.deps), /CONTROLE_RECONEXAO_FALHOU/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir, 'transporte.json'))), meta2);
});

test('recuperação repetida recusa proprietário ou endpoint alterado sem criar nova sessão', async t => {
  for (const caso of ['proprietario', 'endpoint']) {
    const f = reconexaoFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
    await executarProtegido(f.plano, ['reconectar'], f.deps); const n = f.acoes.length;
    if (caso === 'endpoint') f.endpoint += '-outro';
    else f.deps.processos = () => ({ chromePid: 200, daemonPid: 103 });
    await assert.rejects(executarProtegido(f.plano, ['reconectar'], f.deps), /CONTROLE_(RECONEXAO_SEM_IDENTIDADE|PORTA_MUDOU)/);
    assert.equal(f.acoes.length, n);
  }
});

test('falhas pós-ação preservam causa segura, ação única e checkpoint anterior sem registrar conteúdo privado', async t => {
  const casos = [
    ['status', 'endpoint_cli', 'subprocesso_status'],
    ['timeout', 'endpoint_cli', 'spawn_timeout'],
    ['spawn', 'endpoint_cli', 'spawn_erro'],
    ['json_recusado', 'endpoint_parse', 'sondagem_recusada'],
    ['json_invalido', 'endpoint_parse', 'json_invalido'],
    ['targets', 'targets', 'leitura_cdp_falhou'],
    ['pids', 'pids', 'processo_alterado'],
    ['persistencia', 'persistencia', 'arquivo_inseguro'],
  ];
  for (const [caso, subfase, classe] of casos) await t.test(caso, async st => {
    const f = controleFixture(st, ['get', 'url']);
    let tick = 0, leituras = 0, targets = 0, processos = 0, acao = 0, antes;
    f.deps.monotono = () => { tick += 1.25; return tick; };
    const ler = f.deps.executar, listar = f.deps.targets;
    f.deps.executar = (exe, args) => {
      leituras++;
      if (leituras === 2) {
        if (caso === 'status') return { status: 7, signal: 'SIGTERM', stdout: 'sentinela-stdout', stderr: 'sentinela-stderr' };
        if (caso === 'timeout') return { status: null, signal: 'SIGTERM', error: Object.assign(new Error('sentinela-spawn'), { code: 'ETIMEDOUT' }) };
        if (caso === 'spawn') throw Object.assign(new Error('sentinela-spawn'), { code: 'ENOENT' });
        if (caso === 'json_recusado') return { status: 0, stdout: JSON.stringify({ success: false, error: 'sentinela-token ws://127.0.0.1:9/secreto' }) };
        if (caso === 'json_invalido') return { status: 0, stdout: 'sentinela-json-invalido' };
      }
      return ler(exe, args);
    };
    f.deps.targets = async () => { targets++; if (targets === 2 && caso === 'targets') throw Error('sentinela-target ws://127.0.0.1:9/secreto'); return listar(); };
    f.deps.processos = () => { processos++; return { daemonPid: 100, chromePid: caso === 'pids' && processos === 4 ? 201 : 200 }; };
    f.deps.executarAcao = async () => {
      acao++; antes = fs.readFileSync(path.join(f.dir, 'checkpoint.json'));
      if (caso === 'persistencia') fs.linkSync(path.join(f.dir, 'checkpoints.jsonl'), path.join(f.raiz, 'historico-auxiliar'));
      return { codigo: 0, lifecycle: { reused: true } };
    };
    const r = await executarProtegido(f.plano, f.comando, f.deps);
    assert.equal(r.codigo, 1); assert.equal(r.controle, 'reconciliacao_necessaria'); assert.equal(acao, 1);
    assert.deepEqual(fs.readFileSync(path.join(f.dir, 'checkpoint.json')), antes);
    const texto = fs.readFileSync(path.join(f.dir, 'eventos.jsonl'), 'utf8');
    const eventos = texto.trim().split('\n').map(JSON.parse), ultimo = eventos.at(-1);
    assert.equal(eventos.at(-2).codigo, 0); assert.equal(ultimo.fase, 'checkpoint_apos_falhou_sem_retry');
    assert.equal(ultimo.diagnostico.subfase, subfase); assert.equal(ultimo.diagnostico.classe, classe);
    assert.equal(ultimo.diagnostico.duracaoMs, 1.25);
    if (caso === 'status') assert.deepEqual(ultimo.diagnostico, { subfase, classe, duracaoMs: 1.25, status: 7, sinal: 'SIGTERM', erroSpawn: false });
    if (caso === 'timeout') assert.equal(ultimo.diagnostico.erroSpawn, true);
    if (subfase === 'endpoint_parse') assert.equal(ultimo.diagnostico.status, 0);
    assert.ok(!/sentinela|ws:\/\/|stdout|stderr|secreto/.test(texto));
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'bloqueio.json'))).motivo, 'checkpoint_apos_indisponivel');
    await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_RECONCILIACAO_PENDENTE/);
    assert.equal(acao, 1); assert.equal(leituras, 2);
  });
});


test('posse humana bloqueia guard direto, inclusive reconciliação e reconexão, antes de sondar', async t => {
  const f = controleFixture(t);
  fs.writeFileSync(path.join(f.plano.controle.runtime, 'acesso-humano.json'), JSON.stringify({ ativo: true }));
  let sondagens = 0;
  f.deps.processos = () => { sondagens++; throw new Error('não deve consultar processos'); };
  for (const cmd of [['snapshot'], ['fill', '@e1', 'valor'], ['reconciliar'], ['reconectar'], ['close'], ['open', 'https://example.test']]) {
    await assert.rejects(executarProtegido(f.plano, cmd, f.deps), /CONTROLE_ACESSO_HUMANO_ATIVO/);
  }
  assert.equal(sondagens, 0); assert.equal(f.acoes.length, 0); assert.equal(f.leituras.length, 0);
  assert.equal(fs.existsSync(f.dir), false);
});

test('mudança externa de target ou URL exige reconciliação antes de agir', async t => {
  for (const alterado of [{ targetId: 'aba-outra', url: 'https://localiza.gupy.io/candidates/applications/123/steps/456/curriculum' }, { targetId: 'aba-1', url: 'https://localiza.gupy.io/jobs/456' }]) {
    const f = controleFixture(t); await executarProtegido(f.plano, f.comando, f.deps);
    const checkpoint = fs.readFileSync(path.join(f.dir, 'checkpoint.json'), 'utf8');
    f.deps.targets = async () => [{ type: 'page', ...alterado }];
    await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_ALVO_ALTERADO/);
    assert.equal(f.acoes.length, 1);
    assert.equal(fs.readFileSync(path.join(f.dir, 'checkpoint.json'), 'utf8'), checkpoint);
    await executarProtegido(f.plano, ['reconciliar'], f.deps);
    assert.equal(f.acoes.length, 1);
  }
});

test('diagnóstico lifecycle aceita somente classes fixas, sem nomes ou valores arbitrários', () => {
  const result = lifecycleSeguro(JSON.stringify({ lifecycle: { restoreStatus: 'sentinela', saveStatus: 'segredo', settings: { changes: [{ name: 'senhasecreta', effect: 'tokensecreto', from: 'pessoal', to: 'credencial' }] } } }));
  assert.deepEqual(result, { settings: [{ nome: 'omitido' }] });
});


test('inventário exige targetId único para não recuperar por URL ambígua', () => {
  assert.throws(() => inventarioSeguro([{ type: 'page', url: 'https://example.test' }]), /CONTROLE_INVENTARIO_INVALIDO/);
  assert.throws(() => inventarioSeguro([{ type: 'page', targetId: 'duplicado', url: 'about:blank' }, { type: 'page', targetId: 'duplicado', url: 'about:blank' }]), /CONTROLE_INVENTARIO_INVALIDO/);
});


test('guard direto recusa atualização iniciada entre checagem e sondagem', async t => {
  const f = controleFixture(t); const lock = path.join(f.raiz, 'data/operacao/.atualizacao.lock');
  f.deps.processos = () => { fs.mkdirSync(path.dirname(lock), { recursive: true }); fs.mkdirSync(lock); return { chromePid: 200, daemonPid: 100 }; };
  await assert.rejects(executarProtegido(f.plano, f.comando, f.deps), /CONTROLE_ATUALIZACAO_ATIVA/);
  assert.equal(f.acoes.length, 0); assert.equal(f.leituras.length, 0);
  assert.equal(fs.existsSync(path.join(f.dir, 'controlador.lock')), false);
});
