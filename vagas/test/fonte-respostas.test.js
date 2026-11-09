import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerFonteRespostas, selecionarFonteRespostas, marcarPendenciaResposta,
  confirmarRespostaSincronizada, estadoSincroniaRespostas } from '../src/fonte-respostas.js';

const projeto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dados = path.join(projeto, 'vagas', 'data');

test('fonte local é padrão e Notion opcional guarda pendências e hashes sem token', () => {
  const dirDados = fs.mkdtempSync(path.join(dados, 'teste-fonte-respostas-'));
  try {
    assert.equal(lerFonteRespostas({ dirDados }).modo, 'local');
    let estado = selecionarFonteRespostas('local_notion', 'https://notion.so/pagina-exemplo', { dirDados });
    assert.deepEqual(estado.pendentes, ['configuracao']);
    estado = marcarPendenciaResposta('resposta:exemplo', { dirDados });
    assert.deepEqual(estado.pendentes, ['configuracao', 'resposta:exemplo']);
    assert.deepEqual(selecionarFonteRespostas('local_notion', 'https://notion.so/pagina-exemplo', { dirDados }).pendentes, estado.pendentes);
    assert.throws(() => confirmarRespostaSincronizada('resposta:exemplo', { dirDados, raizProjeto: projeto }), /FONTE_DIVERGENTE/);
    estado = confirmarRespostaSincronizada('configuracao', { dirDados, raizProjeto: projeto });
    assert.deepEqual(estado.pendentes, ['resposta:exemplo']);
    estado = confirmarRespostaSincronizada('resposta:exemplo', { dirDados, raizProjeto: projeto });
    assert.deepEqual(estado.pendentes, []);
    assert.match(estado.hashRespostas, /^[a-f0-9]{64}$/);
    assert.equal(estadoSincroniaRespostas({ dirDados, raizProjeto: projeto }).divergente, false);
    assert.equal(selecionarFonteRespostas('local', null, { dirDados }).modo, 'local');
  } finally { fs.rmSync(dirDados, { recursive: true, force: true }); }
});

test('confirmar uma resposta não esconde edição não atribuída no outro Markdown', () => {
  const raizProjeto = fs.mkdtempSync(path.join(dados, 'teste-fonte-divergencia-'));
  const dirDados = path.join(raizProjeto, 'vagas/data');
  fs.mkdirSync(dirDados, { recursive: true });
  fs.mkdirSync(path.join(raizProjeto, 'aplicacao'));
  for (const nome of ['RESPOSTAS.md', 'PERFIL.md']) {
    fs.copyFileSync(path.join(projeto, 'aplicacao', nome), path.join(raizProjeto, 'aplicacao', nome));
  }
  try {
    selecionarFonteRespostas('local_notion', 'https://notion.so/pagina-exemplo', { dirDados });
    confirmarRespostaSincronizada('configuracao', { dirDados, raizProjeto });
    marcarPendenciaResposta('resposta:exemplo', { dirDados });
    fs.appendFileSync(path.join(raizProjeto, 'aplicacao/PERFIL.md'), '\nNota local ainda não sincronizada.\n');
    assert.throws(() => confirmarRespostaSincronizada('resposta:exemplo', { dirDados, raizProjeto }), /FONTE_DIVERGENTE/);
    const estado = estadoSincroniaRespostas({ dirDados, raizProjeto });
    assert.equal(estado.divergente, true);
    assert.deepEqual(estado.pendentes, ['resposta:exemplo']);
  } finally { fs.rmSync(raizProjeto, { recursive: true, force: true }); }
});

test('edição marcada só libera a chave após conferência global dos dois Markdown', () => {
  const raizProjeto = fs.mkdtempSync(path.join(dados, 'teste-fonte-conferencia-'));
  const dirDados = path.join(raizProjeto, 'vagas/data');
  fs.mkdirSync(dirDados, { recursive: true });
  fs.mkdirSync(path.join(raizProjeto, 'aplicacao'));
  for (const nome of ['RESPOSTAS.md', 'PERFIL.md']) {
    fs.copyFileSync(path.join(projeto, 'aplicacao', nome), path.join(raizProjeto, 'aplicacao', nome));
  }
  try {
    selecionarFonteRespostas('local_notion', 'https://notion.so/pagina-exemplo', { dirDados });
    confirmarRespostaSincronizada('configuracao', { dirDados, raizProjeto });
    marcarPendenciaResposta('resposta:exemplo', { dirDados });
    marcarPendenciaResposta('configuracao', { dirDados });
    fs.appendFileSync(path.join(raizProjeto, 'aplicacao/RESPOSTAS.md'), '\nNota editorial de exemplo.\n');
    assert.throws(() => confirmarRespostaSincronizada('resposta:exemplo', { dirDados, raizProjeto }), /FONTE_DIVERGENTE/);
    const global = confirmarRespostaSincronizada('configuracao', { dirDados, raizProjeto });
    assert.deepEqual(global.pendentes, ['resposta:exemplo']);
    const final = confirmarRespostaSincronizada('resposta:exemplo', { dirDados, raizProjeto });
    assert.deepEqual(final.pendentes, []);
    assert.equal(estadoSincroniaRespostas({ dirDados, raizProjeto }).divergente, false);
  } finally { fs.rmSync(raizProjeto, { recursive: true, force: true }); }
});
