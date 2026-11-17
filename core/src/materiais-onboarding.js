import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';

export const TIPOS_MATERIAIS = ['curriculo', 'linkedin', 'adicional'];
export const MAX_ARQUIVO = 15 * 1024 * 1024;

// Lê somente o XML do documento; nunca extrai caminhos do ZIP no disco.
export function textoDocx(bytes) {
  const py = `import sys, io, zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
    info = z.getinfo('word/document.xml')
    if info.file_size > 8 * 1024 * 1024: raise ValueError('Documento muito grande')
    root = ET.fromstring(z.read(info))
    ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    print('\\n'.join(''.join(p.itertext()) for p in root.iter(ns + 'p')))
`;
  const r = spawnSync('python3', ['-c', py], { input: bytes, maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('Não foi possível ler o DOCX. Exporte o documento novamente e tente enviar.');
  return r.stdout.toString('utf8');
}

export function validarMaterial(a) {
  if (!a || !TIPOS_MATERIAIS.includes(a.tipo) || typeof a.nome !== 'string' || typeof a.base64 !== 'string') throw new Error('Escolha um arquivo para currículo, LinkedIn ou material adicional.');
  const extensao = extname(a.nome).toLowerCase();
  const permitidas = a.tipo === 'adicional' ? ['.pdf', '.docx', '.txt'] : ['.pdf', '.docx'];
  if (!permitidas.includes(extensao)) throw new Error(a.tipo === 'adicional' ? 'Envie PDF, DOCX ou TXT.' : 'Envie PDF ou DOCX.');
  if (a.base64.length > Math.ceil(MAX_ARQUIVO / 3) * 4) throw new Error('O arquivo passa de 15 MB. Envie uma versão menor.');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.base64)) throw new Error('Arquivo incompleto. Selecione-o novamente.');
  const bytes = Buffer.from(a.base64, 'base64');
  if (!bytes.length || bytes.length > MAX_ARQUIVO) throw new Error('Envie um arquivo de até 15 MB que não esteja vazio.');
  let texto = null;
  if (extensao === '.pdf' && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('O arquivo não é um PDF válido. Exporte-o novamente.');
  if (extensao === '.docx') texto = textoDocx(bytes);
  if (extensao === '.txt') {
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('Salve o TXT em UTF-8 e envie novamente.'); }
    if (texto.includes('\0')) throw new Error('O TXT precisa conter apenas texto.');
  }
  return { tipo: a.tipo, extensao, bytes, texto };
}
