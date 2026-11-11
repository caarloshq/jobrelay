const REPO_PUBLICO = 'https://github.com/caarloshq/jobrelay';
// ZIP público: validação em memória, staging e reversão; nunca executa conteúdo do pacote.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
const falhar = codigo => { throw Object.assign(new Error(codigo), { codigo }); };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const MAX_ZIP = 32 * 1024 * 1024;
export function permitidoZip(nome) {
  return /^(vagas\/(src|scripts|test)\/|Skills\/|\.agents\/skills\/|\.claude\/skills\/|docs\/|aplicacao\/|coleta\/|quadro\/|onboarding\/|interface\/(src|public|scripts)\/)/.test(nome) ||
    /^(README\.md|AGENTS\.md|CLAUDE\.md|ATUALIZAR\.md|ONBOARDING\.md|DESIGN\.md|PRODUCT\.md|LICENSE|LICENSE\.md|\.gitignore|interface\/(package\.json|pnpm-lock\.yaml|astro\.config\.mjs|tsconfig\.json|[^/]+\.md)|vagas\/(package(-lock)?\.json|\.gitignore|[^/]+\.md))$/.test(nome);
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function lerZip(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_ZIP || bytes.length < 22) falhar('ZIP_INVALIDO');
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { fim = i; break; }
  }
  if (fim < 0 || bytes.readUInt16LE(fim + 4) || bytes.readUInt16LE(fim + 6)) falhar('ZIP_INVALIDO');
  const quantidade = bytes.readUInt16LE(fim + 10), tamanho = bytes.readUInt32LE(fim + 12), inicio = bytes.readUInt32LE(fim + 16);
  if (!quantidade || quantidade > 6000 || bytes.readUInt16LE(fim + 8) !== quantidade || inicio + tamanho !== fim) falhar('ZIP_INVALIDO');
  const entradas = [], nomes = new Set(), intervalos = []; let pos = inicio, total = 0;
  for (let n = 0; n < quantidade; n++) {
    if (pos + 46 > fim || bytes.readUInt32LE(pos) !== 0x02014b50) falhar('ZIP_INVALIDO');
    const flags = bytes.readUInt16LE(pos + 8), metodo = bytes.readUInt16LE(pos + 10), crc = bytes.readUInt32LE(pos + 16);
    const comprimido = bytes.readUInt32LE(pos + 20), descomprimido = bytes.readUInt32LE(pos + 24);
    const nn = bytes.readUInt16LE(pos + 28), extra = bytes.readUInt16LE(pos + 30), comentario = bytes.readUInt16LE(pos + 32);
    const modo = bytes.readUInt32LE(pos + 38) >>> 16, offset = bytes.readUInt32LE(pos + 42);
    if (pos + 46 + nn + extra + comentario > fim || flags & ~0x808 || ![0, 8].includes(metodo) || bytes.readUInt16LE(pos + 34)) falhar('ZIP_INVALIDO');
    const original = bytes.subarray(pos + 46, pos + 46 + nn).toString('utf8');
    if (!original.startsWith('jobrelay/') || original.includes('\\') || original.includes('\0') || original.includes('\ufffd') || original.normalize('NFKC') !== original) falhar('ZIP_CAMINHO_INVALIDO');
    const nome = original.slice(9), diretorio = nome.endsWith('/') || nome === '';
    const partes = nome.replace(/\/$/, '').split('/');
    if (nome && partes.some(p => !p || p === '.' || p === '..' || /[:\x00-\x1f]/.test(p) || p.endsWith('.') || p.endsWith(' '))) falhar('ZIP_CAMINHO_INVALIDO');
    if (partes.some(p => ['.git', 'node_modules'].includes(p.toLowerCase()))) falhar('ZIP_CAMINHO_INVALIDO');
    const chave = nome.toLowerCase().replace(/\/$/, '');
    if (nomes.has(chave)) falhar('ZIP_DUPLICADO'); nomes.add(chave);
    const tipo = modo & 0xf000;
    if (tipo && tipo !== (diretorio ? 0x4000 : 0x8000)) falhar('ZIP_LINK');
    if (offset + 30 > inicio || bytes.readUInt32LE(offset) !== 0x04034b50 || bytes.readUInt16LE(offset + 6) !== flags || bytes.readUInt16LE(offset + 8) !== metodo) falhar('ZIP_INVALIDO');
    const nomeLocal = bytes.readUInt16LE(offset + 26), extraLocal = bytes.readUInt16LE(offset + 28);
    const comeco = offset + 30 + nomeLocal + extraLocal, final = comeco + comprimido;
    if (final > inicio || bytes.subarray(offset + 30, offset + 30 + nomeLocal).toString('utf8') !== original || intervalos.some(([a,b]) => offset < b && final > a)) falhar('ZIP_INVALIDO');
    intervalos.push([offset, final]);
    total += descomprimido;
    if (descomprimido > 16 * 1024 * 1024 || total > 96 * 1024 * 1024) falhar('ZIP_GRANDE');
    const compactado = bytes.subarray(comeco, final);
    let conteudo;
    try { conteudo = metodo === 0 ? Buffer.from(compactado) : inflateRawSync(compactado, { maxOutputLength: Math.max(1, descomprimido) }); } catch { falhar('ZIP_INVALIDO'); }
    if (conteudo.length !== descomprimido || crc32(conteudo) !== crc) falhar('ZIP_INVALIDO');
    if (!diretorio) entradas.push({ nome, conteudo, modo: modo & 0o111 ? 0o755 : 0o644 });
    pos += 46 + nn + extra + comentario;
  }
  if (pos !== fim) falhar('ZIP_INVALIDO');
  return entradas;
}
export async function baixarZip(release, fetchImpl) {
  const canonica = `${REPO_PUBLICO}/releases/download/${release.tag}/jobrelay.zip`;
  if (release.assetUrl !== canonica || !/^[a-f0-9]{64}$/.test(release.assetSha256 || '')) falhar('ASSET_NAO_VERIFICAVEL');
  let url = canonica, resposta;
  for (let i = 0; i < 3; i++) {
    resposta = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'jobrelay-update' } });
    if (![301,302,303,307,308].includes(resposta.status)) break;
    const destino = new URL(resposta.headers.get('location'), url);
    if (destino.protocol !== 'https:' || destino.hostname !== 'release-assets.githubusercontent.com' || destino.username || destino.password || destino.port) falhar('ASSET_ORIGEM_INVALIDA');
    await resposta.body?.cancel(); url = destino.href; resposta = null;
  }
  if (!resposta?.ok || (resposta.url && resposta.url !== url)) falhar('ASSET_INDISPONIVEL');
  if (Number(resposta.headers.get('content-length')) > MAX_ZIP) falhar('ZIP_GRANDE');
  const leitor = resposta.body?.getReader(); if (!leitor) falhar('ZIP_INVALIDO');
  const partes = []; let total = 0;
  try { while (true) { const { done, value } = await leitor.read(); if (done) break; total += value.length; if (total > MAX_ZIP) { await leitor.cancel(); falhar('ZIP_GRANDE'); } partes.push(value); } } finally { leitor.releaseLock(); }
  const bytes = Buffer.concat(partes);
  if (hash(bytes) !== release.assetSha256) falhar('ASSET_HASH_DIVERGENTE');
  return bytes;
}
export function instalarZip({ raiz, dados, bytes, release, proteger, seguroNoDisco, conferir, antesGravar = null }) {
  const todas = lerZip(bytes);
  const ignorado = nome => /^(\.github\/|\.impeccable\/|specs\/|CURRENT-CONTEXT\.md$|interface\/(\.|components\.json$|eslint\.config\.js$|pnpm-workspace\.yaml$))/.test(nome);
  if (todas.some(e => !proteger(e.nome) && !permitidoZip(e.nome) && !ignorado(e.nome))) falhar('ZIP_FORA_ALLOWLIST');
  const entradas = todas.filter(e => !proteger(e.nome) && permitidoZip(e.nome));
  // Uma identidade mínima impede aplicar um ZIP arbitrário ou vazio como instalação.
  const pacote = entradas.find(e => e.nome === 'vagas/package.json');
  let identidade; try { identidade = JSON.parse(pacote?.conteudo.toString('utf8')); } catch { falhar('ZIP_PRODUTO_INVALIDO'); }
  if (identidade?.name !== 'jobrelay' || `v${identidade.version}` !== release.tag || !entradas.some(e => e.nome === 'vagas/src/atualizacao.js')) falhar('ZIP_PRODUTO_INVALIDO');
  const atual = JSON.parse(fs.readFileSync(path.join(raiz, 'vagas/package.json'), 'utf8'));
  for (const chave of ['dependencies', 'devDependencies', 'optionalDependencies']) if (JSON.stringify(atual[chave] || {}) !== JSON.stringify(identidade[chave] || {})) falhar('ZIP_DEPENDENCIAS_ALTERADAS');
  const interfaceNova = entradas.find(e => e.nome === 'interface/package.json');
  if (interfaceNova && fs.existsSync(path.join(raiz, 'interface/package.json'))) {
    seguroNoDisco(path.join(raiz, 'interface/package.json'), 'arquivo');
    const a = JSON.parse(fs.readFileSync(path.join(raiz, 'interface/package.json'), 'utf8')), b = JSON.parse(interfaceNova.conteudo);
    for (const chave of ['dependencies', 'devDependencies', 'optionalDependencies']) if (JSON.stringify(a[chave] || {}) !== JSON.stringify(b[chave] || {})) falhar('ZIP_DEPENDENCIAS_ALTERADAS');
  }
  const id = crypto.randomUUID(), pasta = path.join(dados, 'atualizacao-backups', id);
  seguroNoDisco(path.dirname(pasta), 'diretorio'); fs.mkdirSync(pasta, { recursive: true, mode: 0o700 });
  const stage = path.join(pasta, 'staging'); fs.mkdirSync(stage, { mode: 0o700 });
  const anteriores = [], alterados = []; let finalizado = false;
  const instaladoPath = path.join(dados, 'atualizacao-instalacao.json'); seguroNoDisco(instaladoPath, 'arquivo');
  const registroAnterior = fs.existsSync(instaladoPath) ? fs.readFileSync(instaladoPath) : null;
  if (registroAnterior) {
    let registro; try { registro = JSON.parse(registroAnterior); } catch { falhar('ZIP_REGISTRO_INVALIDO'); }
    if (!Array.isArray(registro.arquivos) || registro.arquivos.some(e => !entradas.some(n => n.nome === e.nome))) falhar('ZIP_REMOCAO_EXIGE_MIGRACAO');
  }
  for (const e of entradas) {
    const destino = path.join(raiz, e.nome); seguroNoDisco(destino, 'arquivo');
    const existe = fs.existsSync(destino), antigo = existe ? fs.readFileSync(destino) : null;
    anteriores.push({ nome: e.nome, existe, hash: antigo && hash(antigo), modo: existe ? fs.statSync(destino).mode & 0o777 : null });
    const staged = path.join(stage, e.nome); fs.mkdirSync(path.dirname(staged), { recursive: true }); fs.writeFileSync(staged, e.conteudo, { flag: 'wx', mode: e.modo });
    if (existe) { const backup = path.join(pasta, 'arquivos', e.nome); fs.mkdirSync(path.dirname(backup), { recursive: true }); fs.writeFileSync(backup, antigo, { flag: 'wx', mode: 0o600 }); }
  }
  const registro = { contrato: 1, tag: release.tag, tagSha: release.tagSha, assetSha256: release.assetSha256, arquivos: anteriores };
  fs.writeFileSync(path.join(pasta, 'manifesto.json'), JSON.stringify(registro, null, 2), { flag: 'wx', mode: 0o600 });
  try {
    conferir();
    for (const [i,e] of entradas.entries()) {
      conferir(); const destino = path.join(raiz, e.nome), anterior = anteriores[i]; seguroNoDisco(destino, 'arquivo');
      if (fs.existsSync(destino) !== anterior.existe || (anterior.existe && hash(fs.readFileSync(destino)) !== anterior.hash)) falhar('CHECKOUT_MUDOU');
      if (antesGravar) antesGravar(e.nome);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.renameSync(path.join(stage, e.nome), destino); alterados.push({ ...anterior, novoHash: hash(e.conteudo) });
    }
    for (const e of entradas) if (hash(fs.readFileSync(path.join(raiz, e.nome))) !== hash(e.conteudo)) falhar('ZIP_VERIFICACAO_FALHOU');
    const novoRegistro = { contrato: 1, tag: release.tag, tagSha: release.tagSha, assetSha256: release.assetSha256, arquivos: entradas.map(e => ({ nome: e.nome, sha256: hash(e.conteudo) })) };
    const tmpRegistro = path.join(pasta, 'instalacao.json');
    fs.writeFileSync(tmpRegistro, JSON.stringify(novoRegistro), { flag: 'wx', mode: 0o600 });
    seguroNoDisco(instaladoPath, 'arquivo'); fs.renameSync(tmpRegistro, instaladoPath);
    finalizado = true;
    return { backup: path.relative(raiz, pasta), arquivos: entradas.length };
  } catch (erro) {
    let falhou = false;
    for (const anterior of alterados.reverse()) {
      try {
        const destino = path.join(raiz, anterior.nome); seguroNoDisco(destino, 'arquivo');
        if (!fs.existsSync(destino) || hash(fs.readFileSync(destino)) !== anterior.novoHash) falhar('CHECKOUT_MUDOU');
        if (anterior.existe) { const tmp = path.join(path.dirname(destino), `.rollback-${id}`); fs.copyFileSync(path.join(pasta, 'arquivos', anterior.nome), tmp, fs.constants.COPYFILE_EXCL); fs.chmodSync(tmp, anterior.modo); fs.renameSync(tmp, destino); }
        else fs.unlinkSync(destino);
      } catch { falhou = true; }
    }
    try {
      seguroNoDisco(instaladoPath, 'arquivo');
      if (registroAnterior) { const tmp = path.join(pasta, 'registro-anterior.json'); fs.writeFileSync(tmp, registroAnterior, {flag:'wx',mode:0o600}); fs.renameSync(tmp, instaladoPath); }
      else if (fs.existsSync(instaladoPath)) fs.unlinkSync(instaladoPath);
    } catch { falhou = true; }
    if (falhou) falhar('ZIP_ROLLBACK_INCERTO');
    throw erro;
  } finally {
    try { fs.writeFileSync(path.join(pasta, 'resultado.json'), JSON.stringify({ instalado: finalizado, em: new Date().toISOString() }), { flag: 'wx', mode: 0o600 }); }
    catch { falhar('ZIP_APLICACAO_INCERTA'); }
  }
}
