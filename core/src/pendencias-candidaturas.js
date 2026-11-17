// Pendências pessoais persistentes. O Markdown é a fonte; JSON é projeção reconstruível.
import fs from 'node:fs';
import { layout } from './layout.js';
import path from 'node:path';
import crypto from 'node:crypto';

const ESPERA = new Int32Array(new SharedArrayBuffer(4));

const CABECALHO = '# Pendências pessoais de candidaturas\n\nRegistre somente ações que dependem da pessoa, com vaga e etapa identificadas. A omissão numa rodada não encerra a pendência. Use o comando `npm run pendencias:candidaturas`; não edite a projeção JSON.\n';
const ESTADOS = new Set(['pendente', 'realizada_aguardando_conferencia', 'resolvida', 'dispensada_com_prova']);
const TIPOS = new Set(['video', 'teste_comportamental', 'outra_acao_pessoal']);
const BLOQUEIOS = new Set(['pendente', 'realizada_aguardando_conferencia']);
const texto = (valor, campo) => {
  if (typeof valor !== 'string' || !valor.trim()) throw new Error(`PENDENCIA_${campo}_OBRIGATORIO`);
  return valor.trim();
};
export const caminhosPendencias = dirDados => ({
  markdown: path.resolve(dirDados) === layout(path.resolve(dirDados, '../..')).dados
    ? path.join(layout(path.resolve(dirDados, '../..')).aplicacao, 'PENDENCIAS-CANDIDATURAS.md')
    : path.resolve(dirDados, '../../aplicacao/PENDENCIAS-CANDIDATURAS.md'),
  json: path.resolve(dirDados, 'pendencias-candidaturas.json'),
});
// Lock próprio da fonte: leitores da rodada não o adquirem sob o lock central.
function diretorioSeguro(diretorio, criar = false) {
  let atual = path.parse(diretorio).root;
  for (const parte of path.relative(atual, diretorio).split(path.sep).filter(Boolean)) {
    atual = path.join(atual, parte);
    if (criar) {
      try { fs.mkdirSync(atual, { mode: 0o700 }); }
      catch (erro) { if (erro.code !== 'EEXIST') throw erro; }
    }
    const info = fs.lstatSync(atual, { throwIfNoEntry: false });
    if (!info) return;
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('PENDENCIAS_CAMINHO_INSEGURO');
  }
}
function arquivoSeguro(arquivo) {
  diretorioSeguro(path.dirname(arquivo));
  const info = fs.lstatSync(arquivo, { throwIfNoEntry: false });
  if (info && (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)) throw new Error('PENDENCIAS_CAMINHO_INSEGURO');
  return info;
}
function comEscritaPendencias(dirDados, operacao) {
  const { markdown } = caminhosPendencias(dirDados);
  diretorioSeguro(path.dirname(markdown), true);
  const trava = path.join(path.dirname(markdown), '.PENDENCIAS-CANDIDATURAS.md.lock');
  const limite = Date.now() + 2000;
  let fd;
  while (fd === undefined) {
    try { fd = fs.openSync(trava, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600); }
    catch (erro) {
      if (erro.code !== 'EEXIST') throw erro;
      arquivoSeguro(trava);
      if (Date.now() >= limite) throw new Error('PENDENCIAS_LOCK_OCUPADO');
      Atomics.wait(ESPERA, 0, 0, 25);
    }
  }
  const identidade = fs.fstatSync(fd);
  try { return operacao(); }
  finally {
    fs.closeSync(fd);
    const atual = arquivoSeguro(trava);
    if (!atual || atual.dev !== identidade.dev || atual.ino !== identidade.ino) throw new Error('PENDENCIAS_LOCK_ALTERADO');
    fs.unlinkSync(trava);
  }
}
function gravarAtomico(destino, conteudo) {
  diretorioSeguro(path.dirname(destino), true);
  arquivoSeguro(destino);
  const temporario = `${destino}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporario, conteudo, { flag: 'wx', mode: 0o600 });
    arquivoSeguro(destino);
    fs.renameSync(temporario, destino);
  } finally {
    try { fs.unlinkSync(temporario); } catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
  }
}
function validar(p) {
  const registro = { ...p };
  for (const campo of ['id', 'idCanonico', 'empresa', 'cargo', 'etapa', 'urlCheckpoint', 'exigencia', 'proximaAcao', 'fonte', 'data']) registro[campo] = texto(registro[campo], campo);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(registro.id)) throw new Error('PENDENCIA_ID_INVALIDO');
  if (!/^[A-Za-z][A-Za-z0-9_-]*:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(registro.idCanonico)) throw new Error('PENDENCIA_VAGA_INVALIDA');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registro.data)) throw new Error('PENDENCIA_DATA_INVALIDA');
  if (!TIPOS.has(registro.tipo) || !ESTADOS.has(registro.estado)) throw new Error('PENDENCIA_TIPO_OU_ESTADO_INVALIDO');
  if (['resolvida', 'dispensada_com_prova'].includes(registro.estado)) {
    registro.provaResolucao = texto(registro.provaResolucao, 'PROVA_RESOLUCAO');
    const prefixo = `${registro.idCanonico}|${registro.etapa}|`;
    if (!registro.provaResolucao.startsWith(prefixo) || !registro.provaResolucao.slice(prefixo.length).trim()) throw new Error('PROVA_VAGA_ETAPA_OBRIGATORIA');
  }
  else if (registro.provaResolucao) throw new Error('PENDENCIA_PROVA_PREMATURA');
  return registro;
}
export function lerPendencias(dirDados) {
  const { markdown } = caminhosPendencias(dirDados);
  if (!arquivoSeguro(markdown)) return [];
  const conteudo = fs.readFileSync(markdown, 'utf8');
  const blocos = [...conteudo.matchAll(/```json pendencia\n([\s\S]*?)\n```/g)];
  const cercas = [...conteudo.matchAll(/^```[^\n]*/gm)];
  if (cercas.length !== blocos.length * 2 || (!blocos.length && conteudo !== CABECALHO + '\nNenhuma pendência registrada.\n')) throw new Error('PENDENCIAS_MARKDOWN_INVALIDO');
  const registros = blocos.map(b => validar(JSON.parse(b[1])));
  if (new Set(registros.map(p => p.id)).size !== registros.length) throw new Error('PENDENCIA_ID_DUPLICADO');
  return registros;
}
export function bloqueiosPendencias(dirDados, idCanonico) {
  return lerPendencias(dirDados).filter(p => p.idCanonico === idCanonico && BLOQUEIOS.has(p.estado));
}
function salvar(dirDados, registros) {
  const { markdown, json } = caminhosPendencias(dirDados);
  diretorioSeguro(path.dirname(markdown), true);
  diretorioSeguro(path.dirname(json), true);
  arquivoSeguro(markdown);
  arquivoSeguro(json);
  const textoMd = CABECALHO + (registros.length ? '\n' + registros.map(p => `\n## ${p.id} · ${p.empresa} · ${p.cargo}\n\nEstado: **${p.estado}** · Ação: ${p.proximaAcao}\n\n\`\`\`json pendencia\n${JSON.stringify(p, null, 2)}\n\`\`\`\n`).join('') : '\nNenhuma pendência registrada.\n');
  for (const [destino, conteudo] of [[markdown, textoMd], [json, JSON.stringify({ versao: 1, pendencias: registros }, null, 2) + '\n']]) {
    gravarAtomico(destino, conteudo);
  }
}
export function registrarPendencias(dirDados, entradas) {
  return comEscritaPendencias(dirDados, () => registrarSemLock(dirDados, entradas));
}
function registrarSemLock(dirDados, entradas) {
  if (!Array.isArray(entradas) || !entradas.length) throw new Error('PENDENCIAS_ENTRADA_INVALIDA');
  const existentes = lerPendencias(dirDados);
  for (const bruto of entradas) {
    const nova = validar({ ...bruto, estado: bruto.estado || 'pendente' });
    const anterior = existentes.find(p => p.id === nova.id);
    if (anterior) {
      if (JSON.stringify(anterior) !== JSON.stringify(nova)) throw new Error('PENDENCIA_ID_EXISTENTE_DIVERGENTE');
      continue;
    }
    if (nova.estado !== 'pendente') throw new Error('PENDENCIA_NOVA_DEVE_SER_PENDENTE');
    if (existentes.some(p => p.idCanonico === nova.idCanonico && p.etapa === nova.etapa && BLOQUEIOS.has(p.estado))) throw new Error('PENDENCIA_VAGA_ETAPA_JA_ABERTA');
    existentes.push(nova);
  }
  salvar(dirDados, existentes);
  return existentes;
}
export function atualizarPendencia(dirDados, id, estado, provaResolucao) {
  return comEscritaPendencias(dirDados, () => atualizarSemLock(dirDados, id, estado, provaResolucao));
}
function atualizarSemLock(dirDados, id, estado, provaResolucao) {
  if (!ESTADOS.has(estado)) throw new Error('PENDENCIA_ESTADO_INVALIDO');
  const registros = lerPendencias(dirDados);
  const indice = registros.findIndex(p => p.id === id);
  if (indice < 0) throw new Error('PENDENCIA_NAO_ENCONTRADA');
  const atual = registros[indice];
  if (!BLOQUEIOS.has(atual.estado)) {
    if (atual.estado === estado && atual.provaResolucao === provaResolucao) return atual;
    throw new Error('PENDENCIA_FECHADA');
  }
  if (estado === 'pendente' && atual.estado !== 'pendente') throw new Error('PENDENCIA_RETROCESSO_INVALIDO');
  if (estado === 'realizada_aguardando_conferencia' && atual.estado !== 'pendente') throw new Error('PENDENCIA_TRANSICAO_INVALIDA');
  const nova = validar({ ...atual, estado, provaResolucao });
  registros[indice] = nova;
  salvar(dirDados, registros);
  return nova;
}


export function projetarPendencias(dirDados) {
  return comEscritaPendencias(dirDados, () => {
    const registros = lerPendencias(dirDados);
    gravarAtomico(caminhosPendencias(dirDados).json, JSON.stringify({ versao: 1, pendencias: registros }, null, 2) + '\n');
    return registros;
  });
}
