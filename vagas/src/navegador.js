import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { exigirOnboardingHumano } from './onboarding-humano.js';

const PORTAIS_LOGIN = Object.freeze({ linkedin: 'https://www.linkedin.com/login', gupy: 'https://login.gupy.io/candidate' });
export const VERSAO_AGENT_BROWSER = '0.42.0';
const ESCRITA = new Set(['click', 'dblclick', 'fill', 'type', 'press', 'select', 'check', 'uncheck', 'upload', 'keyboard', 'keydown', 'keyup', 'drag', 'mouse']);
const SEM_ARGS = new Set(['close', 'back', 'forward', 'reload', 'campos', 'diagnostico', 'console', 'errors']);
const FLAGS = {
  snapshot: new Set(['-i', '--interactive', '-u', '--urls', '-c', '--compact', '-d', '--depth', '-s', '--selector', '--delta', '--full']),
  screenshot: new Set(['--full', '--annotate']),
  click: new Set(['--new-tab']),
  scroll: new Set(['--selector']),
  wait: new Set(['--url', '--text', '--load', '--state', '--timeout']),
};
const erro = mensagem => { throw new Error(mensagem); };
const dentro = (raiz, destino) => destino === raiz || destino.startsWith(`${raiz}${path.sep}`);

// Programa fechado de leitura. Não recebe JavaScript do chamador nem retorna valores dos campos.
export const LEITURA_CAMPOS = `JSON.stringify({escopo:'frame atual',url:location.origin+location.pathname,secoes:[...document.querySelectorAll('h1,h2,h3,legend')].map(e=>e.textContent.trim()),campos:[...document.querySelectorAll('input,textarea,select,[role="combobox"]')].map(e=>({id:e.id||null,nome:e.name||null,tipo:e.type||e.getAttribute('role'),rotulo:e.getAttribute('aria-label')||e.labels?.[0]?.textContent?.trim()||null,obrigatorio:!!e.required||e.getAttribute('aria-required')==='true',vazio:e.type==='file'?!e.files?.length:(e.type==='checkbox'||e.type==='radio')?!e.checked:('value' in e?!e.value:null),desabilitado:!!e.disabled,visivel:!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length),arquivos:e.type==='file'?[...e.files].map(f=>({nome:f.name,tamanho:f.size,tipo:f.type})):undefined})),iframes:[...document.querySelectorAll('iframe')].map(e=>({titulo:e.title||null}))})`;

export function limparAmbiente(ambiente = process.env) {
  const limpo = Object.fromEntries(Object.entries(ambiente).filter(([k]) =>
    !k.startsWith('AGENT_BROWSER_') && !/^(AI_GATEWAY_|OPENAI_API_KEY$|ANTHROPIC_API_KEY$)/.test(k) && !/^(BROWSERBASE_|BROWSERLESS_|BROWSER_USE_|KERNEL_)/.test(k) &&
    !/^(http_proxy|https_proxy|all_proxy|no_proxy)$/i.test(k)));
  return limpo;
}

function diretoriosPrivados(raiz) {
  const dados = path.join(raiz, 'data');
  if (fs.lstatSync(dados, { throwIfNoEntry: false })?.isSymbolicLink()) erro('A pasta de dados não pode ser um link simbólico.');
  fs.mkdirSync(dados, { recursive: true });
  const runtime = path.join(dados, 'navegador');
  for (const relativo of ['', 'perfil', 's', 'tmp', 'downloads', 'capturas', 'cache']) {
    const destino = path.join(runtime, relativo);
    const estado = fs.lstatSync(destino, { throwIfNoEntry: false });
    if (estado && (!estado.isDirectory() || estado.isSymbolicLink())) erro('O runtime privado deve usar diretórios próprios, sem links simbólicos.');
    fs.mkdirSync(destino, { recursive: true, mode: 0o700 });
    fs.chmodSync(destino, 0o700);
  }
  const confiavel = path.join(runtime, 'config-confiavel.json');
  const estadoConfig = fs.lstatSync(confiavel, { throwIfNoEntry: false });
  if (estadoConfig && (!estadoConfig.isFile() || estadoConfig.isSymbolicLink() || estadoConfig.nlink !== 1)) erro('A configuração do runtime precisa ser um arquivo próprio, sem links.');
  if (estadoConfig && fs.readFileSync(confiavel, 'utf8') !== '{}\n') erro('A configuração confiável do runtime mudou. Confira o arquivo antes de continuar.');
  if (!estadoConfig) fs.writeFileSync(confiavel, '{}\n', { mode: 0o600, flag: 'wx' });
  fs.chmodSync(confiavel, 0o600);
  return { runtime, perfil: path.join(runtime, 'perfil'), socket: 'data/navegador/s', tmp: path.join(runtime, 'tmp'), confiavel };
}

function configuracao(raiz) {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'navegador.json'), 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    cfg = { versao: 1, transportePadrao: 'headless', agentBrowserVersion: VERSAO_AGENT_BROWSER, executavelChrome: null, portaAcessoHumano: 4849 };
  }
  if (cfg.versao !== 1 || cfg.transportePadrao !== 'headless' || cfg.agentBrowserVersion !== VERSAO_AGENT_BROWSER ||
      (cfg.executavelChrome !== null && typeof cfg.executavelChrome !== 'string') ||
      (!Number.isInteger(cfg.portaAcessoHumano) || cfg.portaAcessoHumano < 1024 || cfg.portaAcessoHumano > 65535) ||
      Object.keys(cfg).some(k => !['versao', 'transportePadrao', 'agentBrowserVersion', 'executavelChrome', 'portaAcessoHumano'].includes(k))) {
    erro('Configuração do navegador do JobRelay inválida. Confira config/navegador.json.');
  }
  return cfg;
}

function politica(raiz) {
  try { return JSON.parse(fs.readFileSync(path.join(raiz, 'data', 'politica-autonomia.json'), 'utf8')); }
  catch { return null; }
}

export function detectarChrome(cfg, { ambiente = process.env, plataforma = process.platform, executar = spawnSync } = {}) {
  const explicito = ambiente.JOBRELAY_CHROME_EXECUTAVEL || cfg.executavelChrome;
  if (explicito && !path.isAbsolute(explicito)) erro('O executável Chrome explícito precisa ser um caminho absoluto.');
  let candidatos = explicito ? [explicito] : [];
  if (!explicito && plataforma === 'darwin') candidatos = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  if (!explicito && plataforma === 'linux') candidatos = (ambiente.PATH || '').split(path.delimiter).filter(Boolean).flatMap(p => ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(n => path.resolve(p, n)));
  if (!explicito && plataforma === 'win32') candidatos = [ambiente.PROGRAMFILES, ambiente['PROGRAMFILES(X86)'], ambiente.LOCALAPPDATA].filter(Boolean).map(p => path.join(p, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  for (const candidato of candidatos) {
    if (!fs.existsSync(candidato)) continue;
    const resultado = executar(candidato, ['--version'], { encoding: 'utf8', timeout: 10000, env: limparAmbiente(ambiente), shell: false });
    const versao = `${resultado.stdout || ''} ${resultado.stderr || ''}`.trim();
    if (resultado.status === 0 && /(?:Google Chrome|Chromium|Chrome for Testing)\s+\d+\./i.test(versao)) return { caminho: candidato, versao };
  }
  erro(explicito ? 'O Chrome explícito não passou na verificação --version; não houve fallback silencioso.' : 'Chrome instalado não encontrado. Configure executavelChrome ou JOBRELAY_CHROME_EXECUTAVEL; nenhum browser foi baixado.');
}

function urlPermitida(texto) {
  if (texto === 'about:blank') return;
  let url;
  try { url = new URL(texto); } catch { erro('Informe uma URL completa HTTP ou HTTPS.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) erro('Somente URLs HTTP/HTTPS sem credenciais são aceitas.');
}

function validar(args) {
  if (!Array.isArray(args) || !args.length || args.some(a => typeof a !== 'string' || a.includes('\0')) || args.length > 40) erro('Informe um comando e argumentos de texto, ou um array JSON via --stdin-json.');
  const [cmd, ...resto] = args;
  const comandos = new Set([...SEM_ARGS, ...ESCRITA, 'open', 'snapshot', 'screenshot', 'get', 'is', 'wait', 'tab', 'frame', 'scroll', 'scrollintoview', 'hover', 'focus']);
  if (!comandos.has(cmd)) erro('Comando não permitido no navegador do JobRelay. JavaScript arbitrário, cookies, perfis, batch e provedores externos não são expostos.');
  for (const arg of resto) {
    if (arg.startsWith('-') && !(FLAGS[cmd]?.has(arg))) erro('Flag não permitida. Perfil, sessão, CDP, configuração, proxy, engine e scripts são controlados pelo wrapper do JobRelay.');
  }
  if (SEM_ARGS.has(cmd) && resto.length) erro('Este comando não recebe argumentos.');
  if (cmd === 'open') { if (resto.length > 1) erro('open aceita uma URL.'); if (resto[0]) urlPermitida(resto[0]); }
  if (cmd === 'get') {
    const quantidades = { text: 2, html: 2, value: 2, attr: 3, title: 1, url: 1, count: 2, box: 2, styles: 2 };
    if (quantidades[resto[0]] !== resto.length) erro('Subcomando get não permitido ou argumentos inválidos.');
  }
  if (cmd === 'is' && (resto.length !== 2 || !['visible', 'enabled', 'checked'].includes(resto[0]))) erro('Use is visible, enabled ou checked com seletor.');
  if (cmd === 'tab') {
    if (resto[0] === 'new') { if (resto.length > 2) erro('tab new aceita uma URL.'); if (resto[1]) urlPermitida(resto[1]); }
    else if (resto[0] === 'list' || !resto.length) { if (resto.length > 1) erro('tab list não recebe argumentos.'); }
    else if (resto[0] === 'close') { if (resto.length > 2) erro('tab close aceita um identificador.'); }
    else if (resto.length !== 1 || !/^[\w-]+$/.test(resto[0])) erro('Identificador de aba inválido.');
  }
  if (cmd === 'wait') {
    if (!resto.length) erro('wait exige seletor, tempo ou condição sem JavaScript.');
    if (/^\d+$/.test(resto[0]) && Number(resto[0]) > 30000) erro('Espera explícita limitada a 30000 ms.');
    if (resto.includes('--state')) {
      const i = resto.indexOf('--state');
      if (i === 0 || !['visible', 'hidden', 'attached', 'detached'].includes(resto[i + 1])) erro('wait --state aceita somente estado de seletor, nunca arquivo de autenticação.');
    }
    if (resto.includes('--load') && !['load', 'domcontentloaded', 'networkidle'].includes(resto[resto.indexOf('--load') + 1])) erro('Estado de carregamento inválido.');
    if (resto.includes('--timeout')) {
      const n = Number(resto[resto.indexOf('--timeout') + 1]);
      if (!Number.isInteger(n) || n < 1 || n > 30000) erro('Timeout permitido: 1 a 30000 ms.');
    }
  }
  return args.slice();
}

export function prepararComando(args, { raiz, ambiente = process.env, executar = spawnSync, plataforma = process.platform } = {}) {
  args = validar(args);
  raiz = fs.realpathSync(raiz);
  const cfg = configuracao(raiz);
  const modo = politica(raiz)?.modoCandidatura;
  if (ESCRITA.has(args[0]) && modo !== 'chrome_assistido') erro('MODO_MAPEAMENTO: esta política não libera ações de escrita. O transporte headless não altera opt-in nem autoriza envio.');
  if (Number(process.versions.node.split('.')[0]) < 22) erro('O navegador do JobRelay requer Node.js 22 ou mais recente.');
  const pacote = path.join(raiz, 'node_modules', 'agent-browser', 'package.json');
  if (!fs.existsSync(pacote) || JSON.parse(fs.readFileSync(pacote, 'utf8')).version !== VERSAO_AGENT_BROWSER) erro('Instale a dependência local fixada agent-browser 0.42.0 antes de usar este comando.');
  const cli = path.join(raiz, 'node_modules', 'agent-browser', 'bin', 'agent-browser.js');
  const chrome = detectarChrome(cfg, { ambiente, plataforma, executar });
  const dirs = diretoriosPrivados(raiz);
  const env = { ...limparAmbiente(ambiente), AGENT_BROWSER_SOCKET_DIR: dirs.socket, TMPDIR: dirs.tmp,
    XDG_CACHE_HOME: path.join(dirs.runtime, 'cache'), AGENT_BROWSER_RESTORE_SAVE: 'never',
    AGENT_BROWSER_DEFAULT_TIMEOUT: '30000', AGENT_BROWSER_AUTOSAVE_INTERVAL_MS: '0', AGENT_BROWSER_IDLE_TIMEOUT_MS: '0' };
  if (args[0] === 'diagnostico') {
    const versaoCli = executar(process.execPath, [cli, '--version'], { cwd: raiz, env, shell: false, encoding: 'utf8', timeout: 10000 });
    if (versaoCli.status !== 0 || !String(versaoCli.stdout).includes(`agent-browser ${VERSAO_AGENT_BROWSER}`)) erro('O binário local agent-browser não passou na verificação de versão.');
    return { diagnostico: { transportePadrao: cfg.transportePadrao, agentBrowser: String(versaoCli.stdout).trim(), chrome,
      perfil: dirs.perfil, socket: dirs.socket, temporarios: dirs.tmp, modoCandidatura: modo || 'não configurado',
      escritaPermitidaPelaPolitica: modo === 'chrome_assistido', autorizaEnvio: false,
      nota: 'Diagnóstico do transporte; gates, revisão e autorizações continuam obrigatórios. Nenhum browser foi aberto.' } };
  }
  if (args[0] === 'campos') args = ['eval', LEITURA_CAMPOS];
  if (args[0] === 'screenshot') {
    const nomes = args.slice(1).filter(a => !a.startsWith('-'));
    if (nomes.length > 1) erro('screenshot aceita um arquivo de saída.');
    const capturas = path.join(dirs.runtime, 'capturas');
    if (nomes[0] && path.basename(nomes[0]) !== nomes[0]) erro('Use somente um nome de arquivo para a captura local, sem diretórios.');
    const destino = nomes[0] ? path.resolve(capturas, nomes[0]) : path.join(capturas, `captura-${Date.now()}.png`);
    if (!dentro(capturas, destino) || destino === capturas) erro('Salve screenshots somente na pasta privada de capturas.');
    if (fs.lstatSync(destino, { throwIfNoEntry: false })) erro('O destino da captura já existe. Escolha outro nome para preservar o arquivo.');
    args = ['screenshot', destino, ...args.slice(1).filter(a => a.startsWith('-'))];
  }
  if (args[0] === 'upload') {
    if (args.length < 3) erro('upload exige seletor e arquivo local.');
    const projeto = fs.realpathSync(path.join(raiz, '..'));
    args = [args[0], args[1], ...args.slice(2).map(nome => {
      const arquivo = fs.realpathSync(path.resolve(raiz, nome));
      if (!dentro(projeto, arquivo) || !fs.statSync(arquivo).isFile()) erro('O anexo precisa ser um arquivo dentro deste projeto.');
      return arquivo;
    })];
  }
  return { comando: process.execPath, args: [cli, '--config', dirs.confiavel, '--session', 'jobrelay', '--profile', dirs.perfil,
    '--executable-path', chrome.caminho, '--no-auto-connect', '--no-auto-dialog', '--idle-timeout', '0', '--json',
    '--download-path', path.join(dirs.runtime, 'downloads'), ...args], opcoes: { cwd: raiz, env, shell: false, stdio: 'inherit' } };
}


function estadoHumano(raiz) {
  const arquivo = path.join(raiz, 'data', 'navegador', 'acesso-humano.json');
  const st = fs.lstatSync(arquivo, { throwIfNoEntry: false });
  if (!st) return { arquivo, atual: null };
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1) erro('Registro de acesso humano inválido.');
  return { arquivo, atual: JSON.parse(fs.readFileSync(arquivo, 'utf8')) };
}

function gravarAcesso(arquivo, estado) {
  const temporario = arquivo + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temporario, JSON.stringify(estado, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporario, arquivo);
}

async function executarPlano(plano, iniciar = spawn) {
  return new Promise((resolve, reject) => {
    const filho = iniciar(plano.comando, plano.args, plano.opcoes);
    filho.once('error', () => reject(new Error('Não foi possível iniciar o navegador. Execute diagnostico.')));
    filho.once('exit', (codigo, sinal) => resolve({ codigo: codigo ?? 1, sinal }));
  });
}

/**
 * Durante login humano nenhum comando do agente lê ou altera a sessão.
 * O dashboard oficial controla o mesmo daemon; não há segunda abertura do perfil.
 * As injeções servem somente a testes offline e não são flags da CLI.
 */
export async function executarNavegador(args, opcoes = {}) {
  if (!Array.isArray(args) || args.some(a => typeof a !== 'string')) erro('Informe comando e argumentos de texto.');
  const { raiz, iniciar = spawn, conferirOnboarding = exigirOnboardingHumano } = opcoes;
  if (typeof raiz !== 'string' || !path.isAbsolute(raiz)) erro('Informe a raiz absoluta de vagas/.');
  // Verifica requisitos e cria exclusivamente os diretórios da própria instalação.
  const base = prepararComando(['diagnostico'], opcoes);
  const dirs = diretoriosPrivados(raiz);
  const trava = path.join(dirs.runtime, '.comando.lock');
  let fd;
  try { fd = fs.openSync(trava, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') erro('NAVEGADOR_OCUPADO: aguarde o comando atual.'); throw e; }
  try {
    const acesso = estadoHumano(raiz);
    if (args[0] === 'diagnostico') {
      if (args.length !== 1) erro('diagnostico não recebe argumentos.');
      return { ...base.diagnostico, acessoHumano: acesso.atual?.ativo === true, dashboard: 'Somente local, aberto pelo comando login.' };
    }
    conferirOnboarding(path.join(raiz, 'data'));
    if (args[0] === 'retomar') {
      if (args.length !== 2 || args[1] !== '--confirmado-pela-pessoa') erro('Aguarde a pessoa terminar e informar no chat; depois use retomar --confirmado-pela-pessoa.');
      if (!acesso.atual?.ativo) erro('Não há acesso humano pendente.');
      const plano = prepararComando(['snapshot', '-i'], opcoes);
      // Falha na retomada conserva a posse humana.
      const resultado = await executarPlano(plano, iniciar);
      if (resultado.codigo !== 0) return resultado;
      gravarAcesso(acesso.arquivo, { ...acesso.atual, ativo: false, retomadoEm: new Date().toISOString() });
      return { ...resultado, estado: 'retomado', autenticacao: 'Não comprovada por este comando; confira a página.', instrucao: 'A pessoa terminou o acesso. Confira a sessão e o portal antes de continuar; isso não autoriza candidatura.' };
    }
    if (acesso.atual?.ativo) erro('ACESSO_HUMANO_ATIVO: aguarde a pessoa; não leia, preencha, feche ou navegue na sessão durante o login.');
    if (args[0] === 'login') {
      if (args.length !== 2 || !Object.hasOwn(PORTAIS_LOGIN, args[1])) erro('Use login linkedin ou login gupy.');
      const portal = args[1];
      // Não altera a aba de rascunho nem troca o modo do navegador.
      const novaAba = prepararComando(['tab', 'new', PORTAIS_LOGIN[portal]], opcoes);
      const aberta = await executarPlano(novaAba, iniciar);
      if (aberta.codigo !== 0) return aberta;
      const estado = { ativo: true, portal, iniciadoEm: new Date().toISOString(), sessao: 'jobrelay' };
      gravarAcesso(acesso.arquivo, estado);
      const cfg = configuracao(raiz);
      const dashboard = prepararComando(['open', 'about:blank'], opcoes);
      // O comando oficial só inicia o painel; não navega na aba atual.
      dashboard.args = dashboard.args.slice(0, dashboard.args.length - 2).concat(['dashboard', 'start', '--port', String(cfg.portaAcessoHumano)]);
      const iniciado = await executarPlano(dashboard, iniciar);
      if (iniciado.codigo !== 0) return { ...iniciado, estado: 'aguardando_pessoa', instrucao: 'O acesso humano continua reservado. Confira a porta do dashboard; não reinicie nem feche a sessão para contornar o erro.' };
      return {
        codigo: 0, estado: 'aguardando_pessoa', portal,
        urlAcessoHumano: 'http://localhost:' + cfg.portaAcessoHumano,
        instrucao: 'Abra o painel local, selecione a sessão jobrelay e faça o login diretamente na página. Use entrar com LinkedIn somente se o portal oferecer essa opção. Não envie senha ou código no chat. O assistente deve aguardar seu aviso de término, sem observar o login.',
      };
    }
    const plano = prepararComando(args, opcoes);
    return await executarPlano(plano, iniciar);
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(trava);
  }
}
