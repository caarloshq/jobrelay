#!/usr/bin/env node
import fs from 'node:fs';
import { readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { lerFontes } from '../src/fontes-respostas.js';
import { importarLegado, lerFontesInstalacao } from '../src/fontes-instalacao.js';
import { comEscritaCentral } from '../src/operacao.js';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projeto = resolve(raiz, '..');
const caminhos = {
  respostas: resolve(projeto, 'aplicacao/RESPOSTAS.md'),
  perfil: resolve(projeto, 'aplicacao/PERFIL.md'),
  bancoJson: resolve(raiz, 'data/perguntas.json'),
  perfilJson: resolve(raiz, 'config/perfil-candidatura.json'),
  estadoOperacao: resolve(raiz, 'data/operacao/estado.json'),
  lockEscrita: resolve(raiz, 'data/operacao/.escrita.lock'),
  lockAtualizacao: resolve(raiz, 'data/operacao/.atualizacao.lock'),
};

async function existe(caminho) {
  try { await lstat(caminho); return true; }
  catch (erro) { if (erro.code === 'ENOENT') return false; throw erro; }
}

async function arquivoLocal(caminho) {
  const info = await lstat(caminho);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`arquivo não regular ou link simbólico: ${caminho}`);
}

async function operacaoEncerrada() {
  if (await existe(caminhos.lockEscrita) || await existe(caminhos.lockAtualizacao)) {
    throw new Error('operação possui lock; exportação recusada');
  }
  if (await existe(caminhos.estadoOperacao)) {
    await arquivoLocal(caminhos.estadoOperacao);
    const estado = JSON.parse(await readFile(caminhos.estadoOperacao, 'utf8'));
    if (estado.status === 'ativa') throw new Error('operação ativa; exportação recusada');
  }
}

async function exportarProjecoes(banco, perfil, fontes) {
  await operacaoEncerrada();
  if (process.env.VAGAS_OPERACAO_TOKEN) throw new Error('exportação exige execução sem token de operação');
  const alvos = [caminhos.bancoJson, caminhos.perfilJson];
  const conteudos = [`${JSON.stringify(banco, null, 2)}\n`, `${JSON.stringify(perfil, null, 2)}\n`];
  comEscritaCentral(resolve(raiz, 'data'), () => {
    const locais = [caminhos.respostas, caminhos.perfil, ...alvos];
    for (const caminho of locais) {
      const info = fs.lstatSync(caminho);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error(`arquivo inseguro: ${caminho}`);
    }
    if (fs.readFileSync(caminhos.respostas, 'utf8') !== fontes.respostas ||
        fs.readFileSync(caminhos.perfil, 'utf8') !== fontes.perfil) {
      throw new Error('fonte Markdown alterada durante exportação');
    }
    const originais = alvos.map(caminho => fs.readFileSync(caminho, 'utf8'));
    const temporarios = alvos.map(caminho => `${caminho}.jobrelay-${randomUUID()}.tmp`);
    let publicados = 0;
    try {
      for (let i = 0; i < temporarios.length; i++) fs.writeFileSync(temporarios[i], conteudos[i], { flag: 'wx', mode: 0o600 });
      for (let i = 0; i < alvos.length; i++) {
        fs.renameSync(temporarios[i], alvos[i]);
        publicados++;
      }
    } catch (erro) {
      for (let i = 0; i < publicados; i++) {
        const restauracao = `${alvos[i]}.jobrelay-${randomUUID()}.tmp`;
        fs.writeFileSync(restauracao, originais[i], { flag: 'wx', mode: 0o600 });
        fs.renameSync(restauracao, alvos[i]);
      }
      throw erro;
    } finally {
      for (const caminho of temporarios) {
        try { fs.unlinkSync(caminho); }
        catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
      }
    }
  }, alvos);
}

const argumentos = process.argv.slice(2);
if (argumentos.some(a => !['--validar', '--exportar', '--conferir-projecoes', '--importar-legado'].includes(a)) ||
    (argumentos.includes('--importar-legado') && argumentos.length !== 1) ||
    (argumentos.includes('--exportar') && argumentos.includes('--conferir-projecoes'))) {
  console.error('Uso: node scripts/respostas.mjs [--validar | --exportar | --conferir-projecoes | --importar-legado]');
  process.exitCode = 2;
} else {
  try {
    if (argumentos.includes('--importar-legado')) {
      await operacaoEncerrada();
      if (process.env.VAGAS_OPERACAO_TOKEN) throw new Error('importação exige execução sem token de operação');
      const resultado = importarLegado();
      console.log('JSON local importado para Markdown: ' + resultado.importadas + ' perguntas. Opt-in preservado.');
      process.exit(0);
    }
    lerFontesInstalacao();
    await Promise.all([arquivoLocal(caminhos.respostas), arquivoLocal(caminhos.perfil)]);
    const fontes = {
      respostas: await readFile(caminhos.respostas, 'utf8'),
      perfil: await readFile(caminhos.perfil, 'utf8'),
    };
    const { banco, perfil } = lerFontes(fontes);
    if (argumentos.includes('--conferir-projecoes')) {
      const [bancoAtual, perfilAtual] = await Promise.all([
        readFile(caminhos.bancoJson, 'utf8').then(JSON.parse),
        readFile(caminhos.perfilJson, 'utf8').then(JSON.parse),
      ]);
      if (!isDeepStrictEqual(banco, bancoAtual) || !isDeepStrictEqual(perfil, perfilAtual)) {
        throw new Error('projeções JSON divergem das fontes Markdown');
      }
      console.log(`Projeções conferidas: ${banco.perguntas.length} perguntas.`);
    } else if (argumentos.includes('--exportar')) {
      // Projeções são escritas apenas por comando explícito, após validar ambas as fontes.
      await exportarProjecoes(banco, perfil, fontes);
      console.log(`Projeções atualizadas: ${banco.perguntas.length} perguntas.`);
    } else {
      console.log(`Fontes válidas: ${banco.perguntas.length} perguntas.`);
    }
  } catch (erro) {
    console.error(`Falha nas fontes de respostas: ${erro.message}`);
    process.exitCode = 1;
  }
}
