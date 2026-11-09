import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIR_DADOS } from './config.js';

const ARQUIVO = 'fonte-respostas.json';
const PADRAO = Object.freeze({
  versao: 1, modo: 'local', pagina: null,
  hashRespostas: null, hashPerfil: null, conferidoEm: null, pendentes: [],
});
const hash = texto => crypto.createHash('sha256').update(texto).digest('hex');

function arquivo(dirDados) { return path.join(dirDados, ARQUIVO); }

function conferir(dados) {
  if (!dados || dados.versao !== 1 || !['local', 'local_notion'].includes(dados.modo) ||
      (dados.pagina !== null && (typeof dados.pagina !== 'string' || !dados.pagina.trim())) ||
      !Array.isArray(dados.pendentes) || dados.pendentes.some(v => typeof v !== 'string' || !v.trim()) ||
      !['hashRespostas', 'hashPerfil'].every(chave => dados[chave] === null || /^[a-f0-9]{64}$/.test(dados[chave])) ||
      (dados.conferidoEm !== null && !Number.isFinite(Date.parse(dados.conferidoEm)))) {
    throw new Error('FONTE_RESPOSTAS_INVALIDA: confira data/fonte-respostas.json');
  }
  return dados;
}

export function lerFonteRespostas({ dirDados = DIR_DADOS } = {}) {
  const alvo = arquivo(dirDados);
  if (!fs.existsSync(alvo)) return { ...PADRAO, pendentes: [] };
  const st = fs.lstatSync(alvo);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1) throw new Error('FONTE_RESPOSTAS_INSEGURA');
  return conferir(JSON.parse(fs.readFileSync(alvo, 'utf8')));
}

function salvar(dados, dirDados) {
  conferir(dados);
  fs.mkdirSync(dirDados, { recursive: true });
  const alvo = arquivo(dirDados);
  const tmp = alvo + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(dados, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, alvo);
  } finally {
    try { fs.unlinkSync(tmp); } catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
  }
  return dados;
}

export function selecionarFonteRespostas(modo, pagina = null, { dirDados = DIR_DADOS } = {}) {
  if (!['local', 'local_notion'].includes(modo)) throw new Error('Escolha local ou local_notion');
  if (pagina !== null && (typeof pagina !== 'string' || !pagina.trim())) throw new Error('Página Notion inválida');
  const atual = lerFonteRespostas({ dirDados });
  if (atual.modo === modo && atual.pagina === (modo === 'local' ? null : pagina)) return atual;
  return salvar({ ...atual, modo, pagina: modo === 'local' ? null : pagina,
    hashRespostas: null, hashPerfil: null, conferidoEm: null,
    pendentes: modo === 'local_notion' ? [...new Set([...atual.pendentes, 'configuracao'])] : [] }, dirDados);
}

export function marcarPendenciaResposta(chave, { dirDados = DIR_DADOS } = {}) {
  if (typeof chave !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(chave)) throw new Error('Chave de resposta inválida');
  const atual = lerFonteRespostas({ dirDados });
  if (atual.modo === 'local') return atual;
  return salvar({ ...atual, pendentes: [...new Set([...atual.pendentes, chave])] }, dirDados);
}

function hashesFontes(raizProjeto) {
  return {
    hashRespostas: hash(fs.readFileSync(path.join(raizProjeto, 'aplicacao', 'RESPOSTAS.md'), 'utf8')),
    hashPerfil: hash(fs.readFileSync(path.join(raizProjeto, 'aplicacao', 'PERFIL.md'), 'utf8')),
  };
}

export function confirmarRespostaSincronizada(chave, { dirDados = DIR_DADOS, raizProjeto = path.resolve(dirDados, '../..') } = {}) {
  const atual = lerFonteRespostas({ dirDados });
  if (atual.modo !== 'local_notion' || !atual.pagina) throw new Error('Notion de respostas não configurado');
  if (typeof chave !== 'string' || !atual.pendentes.includes(chave)) throw new Error('Pendência de sincronização ausente');
  const presentes = hashesFontes(raizProjeto);
  if (chave !== 'configuracao' &&
      (presentes.hashRespostas !== atual.hashRespostas || presentes.hashPerfil !== atual.hashPerfil)) {
    throw new Error('FONTE_DIVERGENTE: confira ambos os Markdown e o Notion; marque configuracao como pendente antes de confirmar');
  }
  const pendentes = atual.pendentes.filter(item => item !== chave);
  return salvar({ ...atual, ...(chave === 'configuracao' ? presentes : {}),
    conferidoEm: new Date().toISOString(), pendentes }, dirDados);
}

export function estadoSincroniaRespostas({ dirDados = DIR_DADOS, raizProjeto = path.resolve(dirDados, '../..') } = {}) {
  const atual = lerFonteRespostas({ dirDados });
  if (atual.modo === 'local') return { ...atual, divergente: false };
  const presentes = hashesFontes(raizProjeto);
  return { ...atual, divergente: !atual.pagina || presentes.hashRespostas !== atual.hashRespostas ||
    presentes.hashPerfil !== atual.hashPerfil || atual.pendentes.length > 0 };
}
