import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerFontesInstalacao, importarLegado, atualizarPerfilInstalacao } from '../src/fontes-instalacao.js';
import { renderizarFontes } from '../src/fontes-respostas.js';

const projeto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dados = path.join(projeto, 'vagas', 'data');

function fixture() {
  const raiz = fs.mkdtempSync(path.join(dados, 'teste-fontes-instalacao-'));
  for (const pasta of ['aplicacao', 'vagas/data', 'vagas/config']) fs.mkdirSync(path.join(raiz, pasta), { recursive: true });
  for (const nome of ['RESPOSTAS.md', 'PERFIL.md']) {
    fs.copyFileSync(path.join(projeto, 'aplicacao', nome), path.join(raiz, 'aplicacao', nome));
  }
  for (const [origem, destino] of [
    ['vagas/data/perguntas.json', 'vagas/data/perguntas.json'],
    ['vagas/config/perfil-candidatura.json', 'vagas/config/perfil-candidatura.json'],
  ]) fs.copyFileSync(path.join(projeto, origem), path.join(raiz, destino));
  return raiz;
}

test('modelos neutros mais JSON personalizado bloqueiam até importação explícita; opt-in se preserva', () => {
  const raiz = fixture();
  try {
    const arquivo = path.join(raiz, 'vagas/config/perfil-candidatura.json');
    const perfil = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    perfil.identidade.nome_completo = 'Pessoa Exemplo';
    perfil.autorizado = true;
    fs.writeFileSync(arquivo, JSON.stringify(perfil));
    assert.throws(() => lerFontesInstalacao({ raizProjeto: raiz }), /MIGRACAO_PENDENTE/);
    const importado = importarLegado({ raizProjeto: raiz });
    assert.equal(importado.autorizado, true);
    assert.equal(lerFontesInstalacao({ raizProjeto: raiz }).perfil.identidade.nome_completo, 'Pessoa Exemplo');
    const md = fs.readFileSync(path.join(raiz, 'aplicacao/PERFIL.md'), 'utf8');
    fs.writeFileSync(path.join(raiz, 'aplicacao/PERFIL.md'), md + '\nNota editorial local.\n');
    assert.throws(() => importarLegado({ raizProjeto: raiz }), /FONTE_EDITADA/);
    assert.match(fs.readFileSync(path.join(raiz, 'aplicacao/PERFIL.md'), 'utf8'), /Nota editorial local/);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('atualização de campo do onboarding preserva texto editorial e demais autorizações', () => {
  const raiz = fixture();
  try {
    const arquivo = path.join(raiz, 'aplicacao/PERFIL.md');
    fs.appendFileSync(arquivo, '\nNota editorial local.\n');
    atualizarPerfilInstalacao([{ caminho: ['identidade', 'nome_completo'], valor: 'Pessoa Exemplo' }], { raizProjeto: raiz });
    const fontes = lerFontesInstalacao({ raizProjeto: raiz });
    assert.equal(fontes.perfil.identidade.nome_completo, 'Pessoa Exemplo');
    assert.equal(fontes.perfil.autorizado, false);
    assert.match(fs.readFileSync(arquivo, 'utf8'), /Nota editorial local/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(raiz, 'vagas/config/perfil-candidatura.json'), 'utf8')).identidade.nome_completo, 'Pessoa Exemplo');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('par incompleto de Markdown nunca volta ao JSON', () => {
  const raiz = fixture();
  try {
    fs.unlinkSync(path.join(raiz, 'aplicacao/PERFIL.md'));
    assert.throws(() => lerFontesInstalacao({ raizProjeto: raiz }), /FONTES_INCOMPLETAS/);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('falha na segunda escrita restaura ambos os modelos e permite nova importação', () => {
  const raiz = fixture();
  const perfilJson = path.join(raiz, 'vagas/config/perfil-candidatura.json');
  const perfilMd = path.join(raiz, 'aplicacao/PERFIL.md');
  const respostasMd = path.join(raiz, 'aplicacao/RESPOSTAS.md');
  const antigoPerfil = fs.readFileSync(perfilMd, 'utf8');
  const antigasRespostas = fs.readFileSync(respostasMd, 'utf8');
  const perfil = JSON.parse(fs.readFileSync(perfilJson, 'utf8'));
  perfil.identidade.nome_completo = 'Pessoa Exemplo';
  fs.writeFileSync(perfilJson, JSON.stringify(perfil));
  const bancoJson = path.join(raiz, 'vagas/data/perguntas.json');
  const banco = JSON.parse(fs.readFileSync(bancoJson, 'utf8'));
  banco._nota += ' Instalação de teste.';
  fs.writeFileSync(bancoJson, JSON.stringify(banco));
  const renomear = fs.renameSync;
  let disparou = false;
  try {
    fs.renameSync = (origem, destino) => {
      if (!disparou && destino === respostasMd) { disparou = true; throw new Error('falha simulada'); }
      return renomear(origem, destino);
    };
    assert.throws(() => importarLegado({ raizProjeto: raiz }), /falha simulada/);
  } finally { fs.renameSync = renomear; }
  try {
    assert.equal(fs.readFileSync(perfilMd, 'utf8'), antigoPerfil);
    assert.equal(fs.readFileSync(respostasMd, 'utf8'), antigasRespostas);
    assert.equal(JSON.parse(fs.readFileSync(perfilJson, 'utf8')).identidade.nome_completo, 'Pessoa Exemplo');
    assert.equal(importarLegado({ raizProjeto: raiz }).autorizado, false);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('importação explícita retoma arquivo que já contém bytes gerados do mesmo JSON', () => {
  const raiz = fixture();
  try {
    const perfilJson = path.join(raiz, 'vagas/config/perfil-candidatura.json');
    const perfil = JSON.parse(fs.readFileSync(perfilJson, 'utf8'));
    perfil.identidade.nome_completo = 'Pessoa Exemplo';
    fs.writeFileSync(perfilJson, JSON.stringify(perfil));
    const banco = JSON.parse(fs.readFileSync(path.join(raiz, 'vagas/data/perguntas.json'), 'utf8'));
    const gerados = renderizarFontes({ banco, perfil });
    fs.writeFileSync(path.join(raiz, 'aplicacao/PERFIL.md'), gerados.perfil);
    assert.equal(importarLegado({ raizProjeto: raiz }).importadas, 0);
    assert.equal(lerFontesInstalacao({ raizProjeto: raiz }).perfil.identidade.nome_completo, 'Pessoa Exemplo');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});
