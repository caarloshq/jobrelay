import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const falhar = codigo => { throw new Error(`${codigo}: sessão preservada; confira o checkpoint local. reconciliar inventaria o navegador atual sem reiniciar ou repetir ações.`); };
const FLAGS_LANCAMENTO = new Set(['--profile', '--executable-path', '--download-path']);
const ATS = /(^|\.)(gupy\.io|linkedin\.com|breezy\.hr|inhire\.app|greenhouse\.io|ashbyhq\.com|lever\.co|bairesdev\.com|workdayjobs\.com|quickin\.io|teamstation\.dev)$/;
const ETAPAS = new Set(['apply', 'application', 'applications', 'curriculum', 'questions', 'questionnaire', 'experience', 'education', 'review', 'confirmation', 'jobs', 'job']);
const hash = valor => createHash('sha256').update(valor).digest('hex');

export function exigirSemAtualizacao(runtime) {
  const trava = path.resolve(runtime, '..', 'operacao', '.atualizacao.lock');
  if (fs.lstatSync(trava, { throwIfNoEntry: false })) falhar('CONTROLE_ATUALIZACAO_ATIVA');
}

function arquivoProprio(nome) {
  const st = fs.lstatSync(nome, { throwIfNoEntry: false });
  if (st && (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1)) falhar('CONTROLE_ARQUIVO_INSEGURO');
  return st;
}

function lerRegistro(nome) {
  if (!arquivoProprio(nome)) return null;
  try { return JSON.parse(fs.readFileSync(nome, 'utf8')); }
  catch { falhar('CONTROLE_REGISTRO_INVALIDO'); }
}

function diretorioControle(runtime) {
  const dir = path.join(runtime, 'controle');
  const st = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (st && (!st.isDirectory() || st.isSymbolicLink())) falhar('CONTROLE_DIRETORIO_INSEGURO');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  return dir;
}

function pidEstaVivo(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code !== 'ESRCH'; }
}

function adquirirTrava(dir, reconciliar, pidVivo, nome = 'controlador.lock') {
  const lock = path.join(dir, nome), recuperacao = path.join(dir, nome === 'controlador.lock' ? 'recuperacao.lock' : '.comando.recuperacao.lock');
  if (fs.existsSync(recuperacao)) falhar('CONTROLE_OCUPADO');
  const criar = () => { const fd = fs.openSync(lock, 'wx', 0o600); fs.writeFileSync(fd, String(process.pid)); return fd; };
  try { return { fd: criar() }; }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
  if (!reconciliar) falhar('CONTROLE_OCUPADO');
  let exclusivo;
  try { exclusivo = fs.openSync(recuperacao, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') falhar('CONTROLE_OCUPADO'); throw e; }
  try {
    const antes = arquivoProprio(lock);
    if (!antes) return { fd: criar() };
    const pid = Number(fs.readFileSync(lock, 'utf8').trim());
    if (!Number.isSafeInteger(pid) || pid <= 0 || pidVivo(pid)) falhar('CONTROLE_OCUPADO');
    const atual = arquivoProprio(lock);
    if (!atual || atual.ino !== antes.ino || atual.dev !== antes.dev) falhar('CONTROLE_TRAVA_MUDOU');
    // A trava de recuperação serializa os reconciliadores. Chamadas normais não a atravessam.
    fs.unlinkSync(lock);
    return { fd: criar(), pidOrfao: pid };
  } finally { fs.closeSync(exclusivo); fs.unlinkSync(recuperacao); }
}

/** A recuperação da trava externa também exige comando explícito e PID morto. */
export function adquirirTravaComando(runtime, recuperar = false, pidVivo = pidEstaVivo) {
  return adquirirTrava(runtime, recuperar, pidVivo, '.comando.lock');
}

function gravar(dir, nome, dado, append = false) {
  const arquivo = path.join(dir, nome); arquivoProprio(arquivo);
  const destino = append ? arquivo : path.join(dir, `.${process.pid}-${randomUUID()}.tmp`);
  const fd = fs.openSync(destino, append ? 'a' : 'wx', 0o600);
  try { fs.fchmodSync(fd, 0o600); fs.writeFileSync(fd, `${JSON.stringify(dado)}\n`); }
  finally { fs.closeSync(fd); }
  if (!append) fs.renameSync(destino, arquivo);
}

/** Só URLs de candidatura de ATS conhecidos conservam o caminho. Nunca query/hash/login. */
export function urlCheckpoint(valor) {
  if (valor === 'about:blank') return valor;
  let u; try { u = new URL(valor); } catch { return null; }
  if (!['https:', 'http:'].includes(u.protocol)) return null;
  if (u.username || u.password || /(?:auth|login|signin|token|reset|verify|callback|oauth)/i.test(u.pathname)) return `${u.origin}/[autenticacao]`;
  if (!ATS.test(u.hostname)) return `${u.origin}/[rota-omitida]`;
  if (u.pathname.split('/').some(s => s.length > 160 || /@|%40/i.test(s))) return `${u.origin}/[rota-omitida]`;
  return `${u.origin}${u.pathname}`;
}

export function inventarioSeguro(targets) {
  if (!Array.isArray(targets)) falhar('CONTROLE_INVENTARIO_INVALIDO');
  const paginas = targets.filter(t => t.type === 'page');
  if (paginas.some(t => typeof t.targetId !== 'string' || !/^[\w-]{1,80}$/.test(t.targetId)) || new Set(paginas.map(t => t.targetId)).size !== paginas.length) falhar('CONTROLE_INVENTARIO_INVALIDO');
  return paginas.map(t => {
    const url = urlCheckpoint(t.url);
    if (!url) return null;
    const segmentos = new URL(url === 'about:blank' ? 'https://blank.invalid/' : url).pathname.split('/');
    return { url, etapa: segmentos.filter(s => ETAPAS.has(s)).at(-1) || (url === 'about:blank' ? 'vazia' : 'pagina'),
      aba: t.targetId };
  }).filter(Boolean);
}

/** Lê processos, não o browser. A linha de comando é descartada antes de retornar. */
export function processosDaInstalacao(plano, executar = spawnSync) {
  const pidFile = path.join(plano.controle.socketDiretorio || path.join(plano.controle.runtime, 's'), `${plano.controle.sessao || 'jobrelay'}.pid`);
  const pid = arquivoProprio(pidFile) ? Number(fs.readFileSync(pidFile, 'utf8').trim()) : null;
  const r = executar('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8', shell: false, timeout: 5000 });
  if (r.status !== 0) falhar('CONTROLE_PROCESSOS_INDISPONIVEIS');
  const linhas = String(r.stdout).split('\n').map(l => l.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean);
  const daemonPid = linhas.some(l => Number(l[1]) === pid) ? pid : null;
  const perfil = `--user-data-dir=${plano.controle.perfil}`;
  const chrome = linhas.filter(l => !l[3].includes('--type=') && (l[3].endsWith(perfil) || l[3].includes(`${perfil} `) || l[3].includes(`--user-data-dir="${plano.controle.perfil}"`)));
  if (chrome.length > 1) falhar('CONTROLE_BROWSER_AMBIGUO');
  return { daemonPid, chromePid: chrome.length ? Number(chrome[0][1]) : null };
}

export function argumentosSemLancamento(args) {
  const resultado = [];
  for (let i = 0; i < args.length; i++) {
    if (FLAGS_LANCAMENTO.has(args[i])) { i++; continue; }
    if (args[i] === '--no-auto-connect') continue;
    resultado.push(args[i]);
  }
  return resultado;
}

function prefixoLeitura(plano) {
  return [plano.args[0], '--config', plano.controle.confiavel, '--session', plano.controle.sessao || 'jobrelay', '--json'];
}

/** Endpoint vem somente do perfil próprio; nunca de argumento, ambiente ou descoberta ampla. */
export function endpointDoPerfil(plano, chromePid, executar = spawnSync) {
  const nome = path.join(plano.controle.perfil, 'DevToolsActivePort');
  const st = arquivoProprio(nome);
  if (!st || (typeof process.getuid === 'function' && st.uid !== process.getuid())) falhar('CONTROLE_PORTA_INSEGURA');
  const fd = fs.openSync(nome, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let texto;
  try { const atual = fs.fstatSync(fd); if (atual.ino !== st.ino || atual.dev !== st.dev) falhar('CONTROLE_PORTA_MUDOU');
    if (atual.size > 512) falhar('CONTROLE_PORTA_INVALIDA'); texto = fs.readFileSync(fd, 'utf8'); }
  finally { fs.closeSync(fd); }
  const linhas = texto.trim().split(/\r?\n/);
  if (linhas.length !== 2 || !/^\d{1,5}$/.test(linhas[0]) || Number(linhas[0]) < 1 || Number(linhas[0]) > 65535 ||
      !/^\/devtools\/browser\/[A-Za-z0-9-]{1,100}$/.test(linhas[1])) falhar('CONTROLE_PORTA_INVALIDA');
  const r = executar('lsof', ['-nP', '-a', '-p', String(chromePid), '-iTCP:' + linhas[0], '-sTCP:LISTEN', '-Fpn'],
    { encoding: 'utf8', shell: false, timeout: 5000, maxBuffer: 65536 });
  if (r.status !== 0) falhar('CONTROLE_LISTENER_NAO_COMPROVADO');
  const registros = String(r.stdout).trim().split('\n');
  if (registros[0] !== `p${chromePid}` || registros.filter(l => l.startsWith('p')).length !== 1 ||
      !registros.some(l => l === `n127.0.0.1:${linhas[0]}`) ||
      registros.some(l => l.startsWith('n') && ![ `n127.0.0.1:${linhas[0]}`, `n[::1]:${linhas[0]}` ].includes(l))) falhar('CONTROLE_LISTENER_NAO_LOCAL');
  return `ws://127.0.0.1:${linhas[0]}${linhas[1]}`;
}

function planoTransporte(plano, meta) {
  if (meta?.versao !== 1 || !/^recuperacao-[a-f0-9-]{36}$/.test(meta.sessao || '') || !Number.isInteger(meta.chromePid) || !Number.isInteger(meta.daemonPid)) falhar('CONTROLE_TRANSPORTE_INVALIDO');
  const socket = path.join(plano.controle.runtime, 'r');
  const socketRelativo = path.relative(plano.opcoes.cwd, socket);
  if (!socketRelativo || socketRelativo.startsWith('..') || Buffer.byteLength(`${socketRelativo}/${meta.sessao}.sock`) >= 100) falhar('CONTROLE_SOCKET_LONGO');
  const st = fs.lstatSync(socket, { throwIfNoEntry: false });
  if (!st?.isDirectory() || st.isSymbolicLink()) falhar('CONTROLE_TRANSPORTE_INVALIDO');
  const prefixo = [plano.args[0], '--config', plano.controle.confiavel, '--session', meta.sessao,
    '--no-auto-dialog', '--idle-timeout', '0', '--json'];
  return { ...plano, args: [...prefixo, ...plano.args.slice(plano.controle.inicioComando)],
    controle: { ...plano.controle, sessao: meta.sessao, socketDiretorio: socket, inicioComando: prefixo.length },
    opcoes: { ...plano.opcoes, env: { ...plano.opcoes.env, AGENT_BROWSER_SOCKET_DIR: socketRelativo } } };
}

/** Resolve somente metadados locais; não abre nem consulta o navegador. */
export function transporteAtual(plano) {
  const meta = lerRegistro(path.join(plano.controle.runtime, 'controle', 'transporte.json'));
  return meta ? planoTransporte(plano, meta) : plano;
}

function mesmoInventario(a, b) {
  const chaves = tabs => tabs.map(t => JSON.stringify([t.aba, t.url])).sort();
  return JSON.stringify(chaves(a)) === JSON.stringify(chaves(b));
}

function endpointLocal(texto) {
  let dado; try { dado = JSON.parse(texto); } catch { falhar('CONTROLE_CDP_SEM_RESPOSTA'); }
  if (dado.success === false) falhar('CONTROLE_CDP_INDISPONIVEL');
  const procurar = v => typeof v === 'string' && /^wss?:/.test(v) ? v : v && typeof v === 'object' ? Object.values(v).map(procurar).find(Boolean) : null;
  const raw = procurar(dado); let u; try { u = new URL(raw); } catch { falhar('CONTROLE_CDP_SEM_ENDPOINT'); }
  if (u.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) || u.username || u.password || u.search || u.hash) falhar('CONTROLE_CDP_NAO_LOCAL');
  return raw;
}

/** Somente Target.getTargets: nenhum DOM, formulário, cookie ou autenticação. */
export function lerTargets(endpoint, { WebSocketImpl = globalThis.WebSocket, timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocketImpl(endpoint); let encerrado = false;
    const terminar = (erro, result) => { if (encerrado) return; encerrado = true; clearTimeout(timer); ws.close(); erro ? reject(new Error('CONTROLE_CDP_LEITURA_FALHOU')) : resolve(result); };
    const timer = setTimeout(() => terminar(true), timeout);
    ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method: 'Target.getTargets' })));
    ws.addEventListener('error', () => terminar(true));
    ws.addEventListener('close', () => terminar(true));
    ws.addEventListener('message', event => { let d; try { d = JSON.parse(String(event.data)); } catch { return terminar(true); }
      if (d.id === 1) terminar(d.error || !Array.isArray(d.result?.targetInfos), d.result?.targetInfos); });
  });
}

/** Lifecycle é selecionado campo a campo; stderr, URLs e valores de settings não entram no log. */
export function lifecycleSeguro(stdout, stderr = '') {
  let json; try { json = JSON.parse(stdout); } catch { json = null; }
  const l = json?.data?.lifecycle || json?.lifecycle; const out = {};
  if (l) {
    for (const k of ['launched', 'relaunchedBrowser', 'restartedBackground', 'reused']) if (typeof l[k] === 'boolean') out[k] = l[k];
    for (const k of ['restoreStatus', 'saveStatus']) if (['disabled', 'never', 'skipped', 'restored', 'saved', 'failed', 'not_found', 'none', 'success'].includes(l[k])) out[k] = l[k];
    const raw = stdout.match(/"launchHash"\s*:\s*(\d+)/)?.[1]; if (raw) out.launchHashDecimal = raw;
    if (['chrome', 'lightpanda', 'obscura'].includes(l.effectiveLaunch?.engine)) out.engine = l.effectiveLaunch.engine;
    if (Array.isArray(l.settings?.changes)) out.settings = l.settings.changes.map(c => ({
      nome: ['profile', 'executable_path', 'download_path', 'proxy', 'engine', 'viewport', 'color_scheme', 'headless'].includes(c.name || c.setting || c.key) ? c.name || c.setting || c.key : 'omitido',
      ...(typeof c.applied === 'boolean' ? { applied: c.applied } : {}),
      ...(['relaunch', 'restart', 'immediate', 'none', 'next_launch'].includes(c.effect) ? { effect: c.effect } : {}) }));
  }
  const erro = `${json?.error || ''} ${stderr}`;
  if (/CDP|channel closed|websocket|disconnected/i.test(erro)) out.classeErro = 'canal_cdp';
  else if (/timeout|timed out/i.test(erro)) out.classeErro = 'timeout';
  else if (json?.success === false) out.classeErro = 'acao_recusada';
  return out;
}

function executarCapturado(plano, args, { iniciar = spawn, saida = t => process.stdout.write(t), erros = t => process.stderr.write(t) } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const filho = iniciar(plano.comando, args, { ...plano.opcoes, stdio: ['inherit', 'pipe', 'pipe'] });
    filho.stdout.on('data', t => { stdout += t; saida(t); });
    filho.stderr.on('data', t => { stderr += t; erros(t); });
    filho.once('error', () => reject(new Error('CONTROLE_SUBPROCESSO_FALHOU')));
    filho.once('close', (codigo, sinal) => resolve({ codigo: codigo ?? 1, sinal, lifecycle: lifecycleSeguro(stdout, stderr) }));
  });
}

/** Injetáveis permitem provar a integração sem iniciar daemon ou Chrome em testes. */
export async function executarProtegido(plano, comando, deps = {}) {
  exigirSemAtualizacao(plano.controle.runtime);
  // Antes de qualquer sondagem ou lock: nenhuma recuperação assume a posse humana.
  const humano = lerRegistro(path.join(plano.controle.runtime, 'acesso-humano.json'));
  if (humano?.ativo && !plano.controle.retomadaHumana) falhar('CONTROLE_ACESSO_HUMANO_ATIVO');
  const dir = diretorioControle(plano.controle.runtime), lock = path.join(dir, 'controlador.lock');
  const trava = adquirirTrava(dir, ['reconciliar', 'reconectar'].includes(comando[0]), deps.pidVivo || pidEstaVivo);
  const fd = trava.fd;
  const agora = deps.agora || (() => new Date().toISOString());
  const processos = () => deps.processos ? deps.processos(plano) : processosDaInstalacao(plano);
  const executar = deps.executar || spawnSync;
  const targets = deps.targets || lerTargets;
  const executarAcao = deps.executarAcao || executarCapturado;
  const evento = dado => gravar(dir, 'eventos.jsonl', { em: agora(), comando: comando[0], ...dado }, true);
  let configHash = hash(JSON.stringify(plano.args.slice(0, plano.controle.inicioComando)));
  const suspender = motivo => gravar(dir, 'bloqueio.json', { ativo: true, em: agora(), motivo });
  const salvar = (pids, tabs, fase) => { const c = { versao: 1, em: agora(), ...pids, tabs, configHash,
    abasProtegidas: tabs.some(t => t.url !== 'about:blank'), fase };
    gravar(dir, 'checkpoints.jsonl', c, true); gravar(dir, 'checkpoint.json', c); return c; };
  // Only fixed classes and primitive process metadata survive; never exception text or CLI output.
  const monotono = deps.monotono || (() => performance.now());
  let diagnosticoFalha = null;
  const medirEtapa = async (subfase, fn, detalhes = () => ({})) => {
    const inicio = monotono();
    try { return await fn(); }
    catch (e) {
      const d = detalhes() || {}, codigoErro = subfase === 'endpoint_cli' ? d.erroSpawn?.code || e?.code : null;
      const controle = /^CONTROLE_[A-Z_]+/.exec(String(e?.message || ''))?.[0];
      const classes = {
        CONTROLE_CDP_INDISPONIVEL: 'sondagem_recusada', CONTROLE_CDP_SEM_RESPOSTA: 'json_invalido',
        CONTROLE_CDP_SEM_ENDPOINT: 'endpoint_ausente', CONTROLE_CDP_NAO_LOCAL: 'endpoint_recusado',
        CONTROLE_CDP_LEITURA_FALHOU: 'leitura_cdp_falhou', CONTROLE_INVENTARIO_INVALIDO: 'inventario_invalido',
        CONTROLE_PROCESSO_MUDOU_NA_LEITURA: 'processo_alterado', CONTROLE_ARQUIVO_INSEGURO: 'arquivo_inseguro',
      };
      const classe = codigoErro === 'ETIMEDOUT' ? 'spawn_timeout'
        : ['ENOENT', 'EACCES', 'ENOBUFS'].includes(codigoErro) ? 'spawn_erro'
        : subfase === 'endpoint_cli' && d.erroSpawn ? 'spawn_erro'
        : subfase === 'endpoint_cli' && d.status !== undefined && d.status !== 0 ? 'subprocesso_status'
        : classes[controle] || ({ endpoint_cli: 'subprocesso_falhou', endpoint_parse: 'resposta_recusada',
          targets: 'leitura_cdp_falhou', pids: 'processos_falhou', persistencia: 'persistencia_falhou' }[subfase]);
      const elapsed = monotono() - inicio;
      diagnosticoFalha = { subfase, classe, duracaoMs: Number.isFinite(elapsed) ? Math.round(Math.max(0, elapsed) * 1000) / 1000 : null };
      if (subfase === 'endpoint_cli' || subfase === 'endpoint_parse') {
        diagnosticoFalha.status = Number.isSafeInteger(d.status) ? d.status : null;
        diagnosticoFalha.sinal = ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT', 'SIGHUP', 'SIGPIPE', 'SIGSEGV', 'SIGQUIT'].includes(d.signal) ? d.signal : null;
        if (subfase === 'endpoint_cli') diagnosticoFalha.erroSpawn = !!d.erroSpawn || ['ETIMEDOUT', 'ENOENT', 'EACCES', 'ENOBUFS'].includes(codigoErro);
      }
      throw e;
    }
  };
  const inventariar = async () => {
    exigirSemAtualizacao(plano.controle.runtime);
    let r;
    await medirEtapa('endpoint_cli', () => {
      r = executar(plano.comando, [...prefixoLeitura(plano), 'get', 'cdp-url'], { ...plano.opcoes, stdio: 'pipe', encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
      if (r.status !== 0 || r.error) falhar('CONTROLE_CDP_INDISPONIVEL');
    }, () => ({ status: r?.status, signal: r?.signal, erroSpawn: r?.error }));
    const endpoint = await medirEtapa('endpoint_parse', () => endpointLocal(String(r.stdout)), () => ({ status: r.status, signal: r.signal }));
    const tabs = await medirEtapa('targets', async () => inventarioSeguro(await targets(endpoint)));
    return { endpoint, tabs };
  };
  try {
    exigirSemAtualizacao(plano.controle.runtime);
    if (trava.pidOrfao) evento({ fase: 'trava_orfa_recuperada', pidOrfao: trava.pidOrfao });
    const anteriorPath = path.join(dir, 'checkpoint.json');
    const anterior = lerRegistro(anteriorPath);
    const bloqueioPath = path.join(dir, 'bloqueio.json');
    const bloqueio = lerRegistro(bloqueioPath);
    const transportePath = path.join(dir, 'transporte.json');
    const meta = lerRegistro(transportePath);
    if (comando[0] === 'reconectar') {
      // Recuperação repetida é somente explícita: nunca consultar ou fechar o transporte anterior.
      if (meta) planoTransporte(plano, meta); // valida metadados/diretório sem operar a sessão
      const original = processos();
      if (!original.chromePid || !original.daemonPid || !anterior || anterior.chromePid !== original.chromePid) falhar('CONTROLE_RECONEXAO_SEM_IDENTIDADE');
      if (meta && (meta.chromePid !== original.chromePid || meta.proprietarioDaemonPid !== original.daemonPid)) falhar('CONTROLE_RECONEXAO_SEM_IDENTIDADE');
      const endpoint = (deps.endpointPerfil || endpointDoPerfil)(plano, original.chromePid, executar);
      if (meta && hash(endpoint) !== meta.endpointHash) falhar('CONTROLE_PORTA_MUDOU');
      const tabsAntes = inventarioSeguro(await targets(endpoint));
      if (!tabsAntes.length || !mesmoInventario(anterior.tabs, tabsAntes)) falhar('CONTROLE_RECONEXAO_ABAS_DIVERGENTES');
      const confirmacao = processos();
      if (confirmacao.chromePid !== original.chromePid || confirmacao.daemonPid !== original.daemonPid) falhar('CONTROLE_PID_ALTERADO');
      const sessao = `recuperacao-${randomUUID()}`, socket = path.join(plano.controle.runtime, 'r');
      const stSocket = fs.lstatSync(socket, { throwIfNoEntry: false });
      if (stSocket && (!stSocket.isDirectory() || stSocket.isSymbolicLink())) falhar('CONTROLE_TRANSPORTE_INVALIDO');
      fs.mkdirSync(socket, { mode: 0o700, recursive: true }); fs.chmodSync(socket, 0o700);
      const candidato = { versao: 1, sessao, chromePid: original.chromePid, daemonPid: 0, proprietarioDaemonPid: original.daemonPid, endpointHash: hash(endpoint) };
      const anexado = planoTransporte(plano, candidato);
      // Só a nova sessão recebe connect; a sessão proprietária nunca recebe comandos.
      exigirSemAtualizacao(plano.controle.runtime);
      const resultado = await executarAcao(anexado, [...anexado.args.slice(0, anexado.controle.inicioComando), 'connect', endpoint],
        { ...deps, saida: () => {}, erros: () => {} });
      if (resultado.codigo !== 0 || resultado.lifecycle?.classeErro || resultado.lifecycle?.relaunchedBrowser || resultado.lifecycle?.restartedBackground) falhar('CONTROLE_RECONEXAO_FALHOU');
      const donoDepois = processos();
      if (donoDepois.chromePid !== original.chromePid || donoDepois.daemonPid !== original.daemonPid) falhar('CONTROLE_PID_ALTERADO');
      const endpointDepois = (deps.endpointPerfil || endpointDoPerfil)(plano, original.chromePid, executar);
      if (endpointDepois !== endpoint) falhar('CONTROLE_PORTA_MUDOU');
      const tabsDepois = inventarioSeguro(await targets(endpointDepois));
      if (!mesmoInventario(tabsAntes, tabsDepois)) falhar('CONTROLE_RECONEXAO_ABAS_DIVERGENTES');
      const pidsAnexados = deps.processos ? deps.processos(anexado) : processosDaInstalacao(anexado);
      if (pidsAnexados.chromePid !== original.chromePid || !pidsAnexados.daemonPid || pidsAnexados.daemonPid === original.daemonPid || (meta && pidsAnexados.daemonPid === meta.daemonPid)) falhar('CONTROLE_RECONEXAO_DAEMON_INVALIDO');
      const donoFinal = processos();
      if (donoFinal.chromePid !== original.chromePid || donoFinal.daemonPid !== original.daemonPid) falhar('CONTROLE_PID_ALTERADO');
      candidato.daemonPid = pidsAnexados.daemonPid;
      if (meta) gravar(dir, 'transportes.jsonl', meta, true);
      gravar(dir, 'transportes.jsonl', candidato, true);
      gravar(dir, 'transporte.json', candidato);
      plano = anexado; configHash = hash(JSON.stringify(plano.args.slice(0, plano.controle.inicioComando)));
      salvar(pidsAnexados, tabsDepois, 'reconectado');
      gravar(dir, 'bloqueio.json', { ativo: false, em: agora() });
      evento({ fase: 'reconectado_sem_relaunch', ...pidsAnexados, proprietarioDaemonPid: original.daemonPid, abas: tabsDepois.length });
      return { controle: 'reconectado', reiniciouBrowser: false, restaurouRascunhos: false, tabs: tabsDepois };
    }
    if (meta) {
      plano = planoTransporte(plano, meta);
      configHash = hash(JSON.stringify(plano.args.slice(0, plano.controle.inicioComando)));
      const atual = processos();
      if (atual.chromePid !== meta.chromePid || atual.daemonPid !== meta.daemonPid) falhar('CONTROLE_TRANSPORTE_PID_ALTERADO');
      const endpoint = (deps.endpointPerfil || endpointDoPerfil)(plano, meta.chromePid, executar);
      if (hash(endpoint) !== meta.endpointHash) falhar('CONTROLE_PORTA_MUDOU');
      if (comando[0] === 'close') falhar('CONTROLE_CLOSE_ANEXADO_RECUSADO');
    }
    const antes = processos(); evento({ fase: 'antes', ...antes, opcoesLancamentoHash: configHash });
    const reconciliar = comando[0] === 'reconciliar';
    if (bloqueio?.ativo && !reconciliar) falhar('CONTROLE_RECONCILIACAO_PENDENTE');
    if (!antes.chromePid) {
      if (reconciliar && anterior?.encerradaDeliberadamente) {
        gravar(dir, 'bloqueio.json', { ativo: false, em: agora() });
        evento({ fase: 'encerrada_reconhecida', ...antes });
        return { controle: 'encerrada', reiniciou: false, restaurouRascunhos: false, tabs: [] };
      }
      const abrir = comando[0] === 'open' || (comando[0] === 'tab' && comando[1] === 'new');
      if (reconciliar || !abrir || ((anterior || antes.daemonPid) && !anterior?.encerradaDeliberadamente)) falhar('CONTROLE_BROWSER_AUSENTE');
    } else {
      if (!antes.daemonPid) falhar('CONTROLE_DAEMON_AUSENTE');
      if (anterior && (anterior.chromePid !== antes.chromePid || anterior.daemonPid !== antes.daemonPid) && !reconciliar) falhar('CONTROLE_PID_ALTERADO');
      if (anterior?.abasProtegidas && anterior.configHash !== configHash && !reconciliar) falhar('CONTROLE_OPCOES_ALTERADAS');
      const inv = await inventariar();
      if (anterior && !reconciliar && !mesmoInventario(anterior.tabs, inv.tabs)) falhar('CONTROLE_ALVO_ALTERADO');
      await medirEtapa('pids', () => { const aposLeitura = processos();
        if (aposLeitura.chromePid !== antes.chromePid || aposLeitura.daemonPid !== antes.daemonPid) falhar('CONTROLE_PROCESSO_MUDOU_NA_LEITURA'); });
      await medirEtapa('persistencia', () => salvar(antes, inv.tabs, reconciliar ? 'reconciliado' : 'antes'));
      if (reconciliar) { gravar(dir, 'bloqueio.json', { ativo: false, em: agora() }); evento({ fase: 'reconciliado', ...antes, abas: inv.tabs.length }); return { controle: 'reconciliado', reiniciou: false, restaurouRascunhos: false, tabs: inv.tabs }; }
    }
    const args = antes.chromePid ? argumentosSemLancamento(plano.args) : plano.args;
    exigirSemAtualizacao(plano.controle.runtime);
    const resultado = await executarAcao(plano, args, deps);
    const depois = processos(); evento({ fase: 'depois', ...depois, codigo: resultado.codigo, sinal: resultado.sinal || null, lifecycle: resultado.lifecycle || {} });
    if (comando[0] === 'close' && resultado.codigo === 0 && !resultado.lifecycle?.classeErro && !depois.chromePid) {
      const encerrada = { versao: 1, em: agora(), ...depois, tabs: [], configHash, abasProtegidas: false, fase: 'encerrada', encerradaDeliberadamente: true };
      gravar(dir, 'checkpoints.jsonl', encerrada, true); gravar(dir, 'checkpoint.json', encerrada);
      gravar(dir, 'bloqueio.json', { ativo: false, em: agora() });
      evento({ fase: 'encerrada_deliberadamente', ...depois });
      return { codigo: 0, sinal: resultado.sinal };
    }
    // Não consultar o daemon de novo se ele/browser trocou ou se a própria ação falhou.
    if (resultado.codigo !== 0 || resultado.lifecycle?.classeErro || !depois.chromePid || !depois.daemonPid ||
        (antes.chromePid && depois.chromePid !== antes.chromePid) || (antes.daemonPid && depois.daemonPid !== antes.daemonPid) ||
        resultado.lifecycle?.relaunchedBrowser || resultado.lifecycle?.restartedBackground) {
      suspender('acao_ou_transporte_incerto');
      evento({ fase: 'interrompido_sem_retry', ...depois });
      return { codigo: resultado.codigo || 1, sinal: resultado.sinal, controle: 'reconciliacao_necessaria' };
    }
    if (depois.chromePid && depois.daemonPid) {
      try { const inv = await inventariar(); const finais = await medirEtapa('pids', () => { const atuais = processos();
        if (atuais.chromePid !== depois.chromePid || atuais.daemonPid !== depois.daemonPid) falhar('CONTROLE_PROCESSO_MUDOU_NA_LEITURA');
        return atuais; });
        await medirEtapa('persistencia', () => salvar(finais, inv.tabs, 'depois')); }
      catch { suspender('checkpoint_apos_indisponivel'); evento({ fase: 'checkpoint_apos_falhou_sem_retry', ...depois, ...(diagnosticoFalha ? { diagnostico: diagnosticoFalha } : {}) }); return { codigo: 1, controle: 'reconciliacao_necessaria' }; }
    }
    return { codigo: resultado.codigo, sinal: resultado.sinal };
  } catch (e) { const motivo = /^CONTROLE_[A-Z_]+/.exec(e.message)?.[0] || 'CONTROLE_FALHA'; suspender(motivo); evento({ fase: 'bloqueado', motivo, ...(diagnosticoFalha ? { diagnostico: diagnosticoFalha } : {}) }); throw e; }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
