import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// O Google Drive cria um segundo nome temporário (hard link) para cada arquivo que sincroniza,
// em `.tmp.driveupload`. Esse nome extra não altera o dado, porque toda gravação aqui troca o
// arquivo inteiro por um novo. Só os nomes extras achados nessas pastas são tolerados; qualquer
// outro segundo nome continua sendo erro de segurança.
const PASTAS_TEMPORARIAS_DO_DRIVE = ['.tmp.driveupload', '.tmp.drivedownload'];

function pastasDeLinkConhecido(absoluto) {
  const pastas = new Set((process.env.VAGAS_PASTAS_LINK_CONHECIDO || '').split(path.delimiter).filter(Boolean).map(p => path.resolve(p)));
  for (let dir = path.dirname(absoluto); ; ) {
    for (const nome of PASTAS_TEMPORARIAS_DO_DRIVE) pastas.add(path.join(dir, nome));
    const pai = path.dirname(dir);
    if (pai === dir) break;
    dir = pai;
  }
  return [...pastas];
}

function mesmoInode(a, b) { return a.ino === b.ino && a.dev === b.dev; }

/** Verdadeiro quando o arquivo tem um só nome, ou quando todos os outros nomes são do Drive. */
export function nlinkTolerado(absoluto, info) {
  if (info.nlink === 1) return true;
  if (!info.isFile() || info.isSymbolicLink() || !(info.nlink > 1)) return false;
  const contados = new Set();
  const diretorioReal = pasta => {
    // Pasta "do Drive" que é link simbólico levaria a leitura para qualquer lugar: só diretório de verdade.
    try { const st = fs.lstatSync(pasta); return st.isDirectory() && !st.isSymbolicLink(); } catch { return false; }
  };
  const olhar = pasta => {
    if (!diretorioReal(pasta)) return [];
    const filhos = [];
    for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
      const caminho = path.join(pasta, entrada.name);
      let st;
      try { st = fs.lstatSync(caminho); } catch { continue; }
      if (st.isFile() && mesmoInode(st, info)) contados.add(caminho);
      else if (st.isDirectory() && !st.isSymbolicLink()) filhos.push(caminho);
    }
    return filhos;
  };
  for (const pasta of pastasDeLinkConhecido(absoluto)) {
    for (const filho of olhar(pasta)) olhar(filho);
    if (contados.size >= info.nlink - 1) return true;
  }
  return false;
}

function validarAncestrais(diretorio) {
  const raiz = path.parse(diretorio).root;
  let atual = raiz;
  for (const parte of path.relative(raiz, diretorio).split(path.sep).filter(Boolean)) {
    atual = path.join(atual, parte);
    let info;
    try { info = fs.lstatSync(atual); }
    catch (erro) { if (erro.code === 'ENOENT') return; throw erro; }
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`CAMINHO_INSEGURO: ancestral não é diretório real: ${atual}`);
  }
}

function caminhoSeguro(caminho, criarDiretorio = false) {
  if (typeof caminho !== 'string' || !path.isAbsolute(caminho)) throw new Error('CAMINHO_INVALIDO: esperado caminho absoluto');
  const absoluto = path.resolve(caminho);
  const diretorio = path.dirname(absoluto);
  validarAncestrais(diretorio);
  if (criarDiretorio) fs.mkdirSync(diretorio, { recursive: true });
  validarAncestrais(diretorio);
  let real;
  try { real = fs.realpathSync(diretorio); }
  catch (erro) {
    if (erro.code === 'ENOENT' && !criarDiretorio) return absoluto;
    throw erro;
  }
  if (real !== diretorio) throw new Error('CAMINHO_INSEGURO: diretório contém link simbólico');
  try {
    const info = fs.lstatSync(absoluto);
    if (info.isSymbolicLink() || !info.isFile() || !nlinkTolerado(absoluto, info)) throw new Error('CAMINHO_INSEGURO: JSON existente não é arquivo regular exclusivo');
  } catch (erro) {
    if (erro.code !== 'ENOENT') throw erro;
  }
  return absoluto;
}

export function lerJsonComHash(caminho, inicial) {
  const absoluto = caminhoSeguro(caminho);
  let anterior;
  try { anterior = fs.lstatSync(absoluto); }
  catch (erro) {
    if (erro.code === 'ENOENT' && arguments.length >= 2) return { dados: structuredClone(inicial), hash: null };
    if (erro.code === 'ENOENT') throw new Error(`ARQUIVO_AUSENTE: ${absoluto}`);
    throw erro;
  }
  if (!anterior.isFile() || anterior.isSymbolicLink() || !nlinkTolerado(absoluto, anterior)) throw new Error(`CAMINHO_INSEGURO: ${absoluto}`);
  let fd;
  try {
    if (fs.realpathSync(absoluto) !== absoluto) throw new Error(`CAMINHO_INSEGURO: ${absoluto}`);
    fd = fs.openSync(absoluto, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const aberto = fs.fstatSync(fd);
    if (!aberto.isFile() || !nlinkTolerado(absoluto, aberto) || aberto.ino !== anterior.ino || aberto.dev !== anterior.dev) throw new Error(`ARQUIVO_ALTERADO_DURANTE_LEITURA: ${absoluto}`);
    if (fs.realpathSync(absoluto) !== absoluto) throw new Error(`CAMINHO_INSEGURO: ${absoluto}`);
    const bruto = fs.readFileSync(fd);
    const depois = fs.fstatSync(fd);
    if (depois.size !== bruto.length || depois.ino !== aberto.ino || depois.dev !== aberto.dev) throw new Error(`ARQUIVO_ALTERADO_DURANTE_LEITURA: ${absoluto}`);
    let dados;
    try { dados = JSON.parse(bruto.toString('utf8')); }
    catch { throw new Error(`JSON_INVALIDO: ${absoluto}`); }
    return { dados, hash: crypto.createHash('sha256').update(bruto).digest('hex') };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function lerJsonSeguro(caminho, inicial) {
  return (arguments.length >= 2 ? lerJsonComHash(caminho, inicial) : lerJsonComHash(caminho)).dados;
}

export function gravarJsonAtomico(caminho, valor) {
  const absoluto = caminhoSeguro(caminho, true);
  const diretorio = path.dirname(absoluto);
  const temporario = path.join(diretorio, `.${path.basename(absoluto)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const conteudo = JSON.stringify(valor, null, 2);
  if (conteudo === undefined) throw new Error('JSON_INVALIDO: valor não serializável');
  let fd;
  try {
    fd = fs.openSync(temporario, 'wx', 0o600);
    fs.writeFileSync(fd, `${conteudo}\n`, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    // Revalidar antes de publicar evita substituir link criado após a checagem inicial.
    caminhoSeguro(absoluto);
    fs.renameSync(temporario, absoluto);
    const dfd = fs.openSync(diretorio, 'r');
    try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temporario); } catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
  }
  return absoluto;
}
