import crypto from 'node:crypto';
import { contemMetatexto } from './texto-respostas.js';

const texto = valor => typeof valor === 'string' && valor.trim().length > 0;
const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
const papeis = ['respostas', 'perfil', 'voz', 'escrita'];
const criterios = ['pergunta', 'clareza', 'fatos', 'voz', 'escopo'];
function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (objeto(valor)) return Object.fromEntries(Object.keys(valor).sort().map(chave => [chave, canonico(valor[chave])]));
  return valor;
}

/** Vincula o parecer ao conteúdo integral, inclusive contexto, limites e fontes. */
export function hashPacoteRespostas(pacote) {
  return crypto.createHash('sha256').update(JSON.stringify(canonico(pacote)) ?? 'null').digest('hex');
}

/** Guarda de completude e integridade. O parecer continua sendo trabalho editorial
 * do agente independente; esta função não simula julgamento de qualidade. */
export function validarRevisaoRespostas(pacote, parecer, { autor } = {}) {
  const erros = [];
  if (!objeto(pacote)) return { ok: false, erros: ['PACOTE_RESPOSTAS_INVALIDO'] };
  const contexto = pacote.contexto;
  if (!objeto(contexto) || !texto(contexto.empresa) || !texto(contexto.vaga)) erros.push('CONTEXTO_RESPOSTAS_OBRIGATORIO');
  const fontes = Array.isArray(pacote.fontes) ? pacote.fontes : [];
  for (const papel of papeis) {
    if (!fontes.some(f => objeto(f) && f.papel === papel && texto(f.caminho) && /^[a-f0-9]{64}$/.test(f.hash))) erros.push(`FONTE_REVISAO_OBRIGATORIA:${papel}`);
  }
  if (fontes.some(f => !objeto(f) || !texto(f.papel) || !texto(f.caminho) || !/^[a-f0-9]{64}$/.test(f.hash))) erros.push('FONTE_REVISAO_INVALIDA');
  const campos = Array.isArray(pacote.campos) ? pacote.campos : [];
  if (!Array.isArray(pacote.campos)) erros.push('CAMPOS_RESPOSTAS_OBRIGATORIOS');
  campos.forEach((campo, i) => {
    if (!objeto(campo)) { erros.push(`CAMPO_RESPOSTA_INVALIDO:${i}`); return; }
    for (const chave of ['pergunta', 'texto', 'fonte', 'escopo']) if (!texto(campo[chave])) erros.push(`CAMPO_RESPOSTA_OBRIGATORIO:${i}:${chave}`);
    if (texto(campo.fonte) && !fontes.some(f => texto(f?.caminho) && (campo.fonte === f.caminho || campo.fonte.startsWith(`${f.caminho}#`)))) erros.push(`FONTE_CAMPO_NAO_VINCULADA:${i}`);
    if (contemMetatexto(campo.texto)) erros.push(`RESPOSTA_CONTEM_METATEXTO:${i}`);
    if (Array.isArray(pacote.vetos) && pacote.vetos.some(veto => texto(veto) && normalizar(campo.texto).includes(normalizar(veto)))) erros.push(`RESPOSTA_CONTEM_VETO:${i}`);
    if (campo.limite !== undefined && (!Number.isInteger(campo.limite) || campo.limite < 1 || typeof campo.texto !== 'string' || [...campo.texto].length > campo.limite)) erros.push(`LIMITE_RESPOSTA_INVALIDO:${i}`);
    if (campo.tipo === 'literal' && (!Array.isArray(campo.alternativas) || !campo.alternativas.every(texto) || !campo.alternativas.includes(campo.texto))) erros.push(`ALTERNATIVA_LITERAL_INVALIDA:${i}`);
  });
  if (pacote.vetos !== undefined && (!Array.isArray(pacote.vetos) || !pacote.vetos.every(texto))) erros.push('VETOS_RESPOSTAS_INVALIDOS');
  if (Array.isArray(pacote.campos) && pacote.campos.length === 0) return { ok: erros.length === 0, erros };
  if (!objeto(parecer)) return { ok: false, erros: [...erros, 'PARECER_EDITORIAL_OBRIGATORIO'] };
  if (!texto(autor) || !texto(parecer.revisor) || normalizar(autor) === normalizar(parecer.revisor)) erros.push('REVISAO_EDITORIAL_NAO_INDEPENDENTE');
  if (parecer.hashPacote !== hashPacoteRespostas(pacote)) erros.push('HASH_REVISAO_RESPOSTAS_DIVERGENTE');
  if (parecer.decisao !== 'aprovado') erros.push('REVISAO_EDITORIAL_NAO_APROVADA');
  // Evidência precisa apontar conteúdo consultável do pacote, além de uma frase.
  // O requisito detecta parecer vazio/genérico; não comprova a análise editorial.
  const ancoras = campos.flatMap(c => objeto(c) ? [c.pergunta, c.texto, c.fonte] : []).filter(v => texto(v) && v.length >= 8);
  const citaConteudo = evidencia => ancoras.some(a => evidencia.includes(a))
    || [...evidencia.matchAll(/["“]([^"”]{8,})["”]/g)].some(m => ancoras.some(a => a.includes(m[1])));
  for (const criterio of criterios) {
    const item = parecer.criterios?.[criterio];
    if (!objeto(item) || item.ok !== true || !texto(item.evidencia) || item.evidencia.trim().length < 20 || !citaConteudo(item.evidencia)) erros.push(`CRITERIO_EDITORIAL_INCOMPLETO:${criterio}`);
  }
  // Um lote não pode justificar só o primeiro campo e aprovar os demais por arrasto.
  const evidencias = criterios.map(c => parecer.criterios?.[c]?.evidencia).filter(texto);
  campos.forEach((campo, i) => {
    if (!objeto(campo)) return;
    const referencias = [campo.pergunta, campo.texto].filter(v => texto(v) && v.length >= 8);
    const coberto = evidencias.some(e => referencias.some(r => e.includes(r))
      || [...e.matchAll(/["“]([^"”]{8,})["”]/g)].some(m => referencias.some(r => r.includes(m[1]))));
    // Campos literais curtos podem ser identificados pela pergunta ou pelo índice.
    if (!coberto && !evidencias.some(e => e.includes(`[campo:${i}]`))) erros.push(`CAMPO_SEM_EVIDENCIA_EDITORIAL:${i}`);
  });
  if (!Array.isArray(parecer.achados) || parecer.achados.length > 0) erros.push('ACHADOS_EDITORIAIS_PENDENTES');
  return { ok: erros.length === 0, erros };
}
