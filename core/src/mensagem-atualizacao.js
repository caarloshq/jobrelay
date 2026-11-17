import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { URL_ULTIMA_RELEASE } from './versao-produto.js';
import { formatarMensagemOperacao } from './mensagens-operacao.js';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function seguro(raiz, arquivo, tipo = 'arquivo') {
  if (!arquivo.startsWith(raiz + path.sep)) throw Error('MENSAGEM_CAMINHO_INSEGURO');
  let atual = raiz;
  for (const parte of path.relative(raiz, arquivo).split(path.sep)) {
    atual = path.join(atual, parte);
    if (!fs.existsSync(atual)) { try { fs.lstatSync(atual); } catch (e) { if (e.code === 'ENOENT') return; throw e; } }
    const s = fs.lstatSync(atual);
    if (s.isSymbolicLink() || (atual !== arquivo && !s.isDirectory()) || (atual === arquivo && (tipo === 'diretorio' ? !s.isDirectory() : !s.isFile() || s.nlink !== 1))) throw Error('MENSAGEM_CAMINHO_INSEGURO');
  }
}
// Só relata a conversão após o bootstrap real e uma identidade de instalação verificável.
// Ausência de recibo, nota ou identidade mantém silêncio; nunca inventa a release mais recente.
export async function apresentarAtualizacaoConferida({ raiz, saida = console.log, fetch: buscar = globalThis.fetch } = {}) {
  raiz = path.resolve(raiz);
  const payloadPath = path.join(raiz, 'vagas/src/compat-layout/conteudo.json');
  const journalPath = path.join(raiz, 'local/migracao-ponte.json');
  if (!fs.existsSync(payloadPath) || !fs.existsSync(journalPath)) return { apresentada: false };
  seguro(raiz, payloadPath); seguro(raiz, journalPath);
  const { bootstrap } = await import(pathToFileURL(path.join(raiz, 'vagas/src/compat-layout/bootstrap.mjs')).href);
  const conferido = await bootstrap(raiz);
  if (conferido.estado !== 'concluida') return { apresentada: false };
  const payload = JSON.parse(fs.readFileSync(payloadPath));
  const versao = JSON.parse(fs.readFileSync(path.join(raiz, 'core/package.json'))).version;
  if (payload.versao !== versao || !/^\d+\.\d+\.\d+$/.test(versao)) return { apresentada: false };
  const dados = path.join(raiz, 'local/data');
  seguro(raiz, dados, 'diretorio');
  const trava = path.join(dados, '.mensagem-atualizacao.lock');
  // Exclusão sem takeover por tempo. Uma interrupção deixa a apresentação bloqueada,
  // preservando o registro para conferência; nunca duplica a nota por retentativa.
  try { fs.mkdirSync(trava, { mode: 0o700 }); }
  catch (e) { if (e.code === 'EEXIST') return { apresentada: false, apresentacaoOcupada: true }; throw e; }
  const dono = fs.lstatSync(trava);
  try {
  let identidade = null; let notaRegistrada = null;
  for (const nome of ['atualizacao.json', 'atualizacao-instalacao.json']) {
    const arquivo = path.join(dados, nome); seguro(raiz, arquivo);
    if (!fs.existsSync(arquivo)) continue;
    const r = JSON.parse(fs.readFileSync(arquivo));
    if (r.tag !== `v${versao}` || !/^[a-f0-9]{40}$/.test(r.tagSha || '') || r.trava || r.registro === 'falhou') continue;
    if (nome === 'atualizacao.json') {
      if (!['atualizado', 'sem_atualizacao'].includes(r.status)) continue;
      try {
        const git = args => execFileSync('git', ['-C', raiz, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (git(['rev-parse', 'HEAD']) !== r.commit || git(['rev-parse', `${r.tagSha}^{commit}`]) !== r.commit) continue;
      } catch { continue; }
    } else {
      if (!/^[a-f0-9]{64}$/.test(r.assetSha256 || '') || !r.arquivos?.some(e => e.nome === 'vagas/src/compat-layout/conteudo.json' && e.sha256 === conferido.digest)) continue;
    }
    identidade = { tag: r.tag, tagSha: r.tagSha, digest: conferido.digest };
    if (typeof r.notaRelease === 'string' && r.publicadaEm) notaRegistrada = r.notaRelease;
    break;
  }
  if (!identidade) return { apresentada: false };
  const chave = sha(JSON.stringify(identidade));
  const registro = path.join(dados, 'mensagem-atualizacao.json'); seguro(raiz, registro);
  if (fs.existsSync(registro) && JSON.parse(fs.readFileSync(registro)).chave === chave) return { apresentada: false, jaApresentada: true };
  let nota = notaRegistrada;
  if (!nota || nota.includes('DATA_PUBLICACAO')) {
    try {
      const api = URL_ULTIMA_RELEASE.replace(/\/releases\/latest$/, '');
      const opcoes = { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'jobrelay-pos-checagem' } };
      const res = await buscar(`${api}/releases/tags/${identidade.tag}`, opcoes);
      const refRes = await buscar(`${api}/git/ref/tags/${identidade.tag}`, opcoes);
      if (!res.ok || !refRes.ok) return { apresentada: false, notaPendente: true };
      const release = await res.json(), ref = await refRes.json();
      if (release.tag_name !== identidade.tag || release.draft !== false || release.prerelease !== false || !release.published_at || ref.object?.sha !== identidade.tagSha || typeof release.body !== 'string' || !release.body.trim() || release.body.includes('DATA_PUBLICACAO')) return { apresentada: false, notaPendente: true };
      nota = release.body;
    } catch { return { apresentada: false, notaPendente: true }; }
  }
  const mensagem = formatarMensagemOperacao('update_confirmado', { versao, nota, posChecagemConfirmada: true, dadosPreservados: true });
  saida(mensagem);
  const tmp = registro + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ chave, ...identidade, notaSha256: sha(nota) }), { flag: 'wx', mode: 0o600 });
  seguro(raiz, registro); fs.renameSync(tmp, registro);
  return { apresentada: true, versao };
  } finally {
    const atual = fs.lstatSync(trava);
    if (atual.isSymbolicLink() || !atual.isDirectory() || atual.dev !== dono.dev || atual.ino !== dono.ino) throw Error('MENSAGEM_TRAVA_MUDOU');
    fs.rmdirSync(trava);
  }
}

