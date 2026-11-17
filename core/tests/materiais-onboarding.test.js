import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { validarMaterial } from '../src/materiais-onboarding.js';
const material = (tipo, nome, bytes) => ({ tipo, nome, base64: Buffer.from(bytes).toString('base64') });

test('PDF só é aceito nos tipos e formatos permitidos', () => {
  assert.equal(validarMaterial(material('curriculo', 'cv.pdf', '%PDF-1.7\nfixture')).extensao, '.pdf');
  assert.throws(() => validarMaterial(material('curriculo', 'cv.pdf', 'conteúdo renomeado')), /PDF válido/);
  assert.throws(() => validarMaterial(material('curriculo', 'cv.txt', 'texto')), /PDF ou DOCX/);
  assert.throws(() => validarMaterial(material('../fora', 'cv.pdf', '%PDF-1.7')), /Escolha um arquivo/);
});
test('TXT adicional preserva texto UTF-8 e rejeita binário e vazio', () => {
  assert.equal(validarMaterial(material('adicional', 'portfolio.txt', 'Experiência em produto.')).texto, 'Experiência em produto.');
  assert.throws(() => validarMaterial(material('adicional', 'a.txt', '\0teste')), /apenas texto/);
  assert.throws(() => validarMaterial(material('adicional', 'a.txt', '')), /não esteja vazio/);
  assert.throws(() => validarMaterial(material('adicional', 'a.txt', Buffer.from([255]))), /UTF-8/);
});
test('DOCX é lido como documento e ZIP renomeado é recusado', () => {
  const r = spawnSync('python3', ['-c', `import io, zipfile, sys
b = io.BytesIO()
with zipfile.ZipFile(b, 'w') as z:
    z.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Experiência fictícia</w:t></w:r></w:p></w:body></w:document>')
sys.stdout.buffer.write(b.getvalue())`]);
  assert.equal(r.status, 0);
  assert.match(validarMaterial(material('curriculo', 'cv.docx', r.stdout)).texto, /Experiência fictícia/);
  assert.throws(() => validarMaterial(material('linkedin', 'perfil.docx', 'PKfake')), /ler o DOCX/);
});
