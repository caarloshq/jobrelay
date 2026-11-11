// Markdown é a única fonte das regras; este módulo só controla sua leitura/escrita.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { comEscritaCentral } from './operacao.js';

export { lerRegras, MODELO_REGRAS } from './regras-projeto-leitura.js';
import { lerRegras, MODELO_REGRAS } from './regras-projeto-leitura.js';
const hash = texto => createHash('sha256').update(texto).digest('hex');
function campo(valor, nome) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > 6000 || /\x00/.test(valor)) throw new Error(`REGRAS_${nome}_INVALIDO`);
  return valor.trim();
}
export function registrarRegra(raiz, { id, texto, fonte, alcance, hashEsperado, tipo = 'decisao' }, dirDados = path.join(raiz, 'vagas/data')) {
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(id || '')) throw new Error('REGRAS_ID_INVALIDO');
  if (!['decisao', 'relato', 'pendente'].includes(tipo)) throw new Error('REGRAS_TIPO_INVALIDO');
  const entrada = { texto: campo(texto, 'TEXTO'), fonte: campo(fonte, 'FONTE'), alcance: campo(alcance, 'ALCANCE') };
  const atual = lerRegras(raiz);
  return comEscritaCentral(dirDados, () => {
    const lido = lerRegras(raiz);
    if (!hashEsperado || lido.hash !== hashEsperado) throw new Error('REGRAS_CONFLITO: releia antes de registrar');
    if (lido.texto.includes(`<!-- regra:${id} -->`)) throw new Error('REGRAS_ID_EXISTENTE: corrija a entrada dona');
    const proximo = lido.texto.trimEnd() + `\n\n<!-- regra:${id} -->\n## ${id}\n\nTipo: ${tipo}. Fonte: ${entrada.fonte}\n\nAlcance: ${entrada.alcance}\n\n${entrada.texto}\n`;
    const tmp = lido.arquivo + '.' + randomUUID() + '.tmp';
    try { fs.writeFileSync(tmp, proximo, { flag: 'wx', mode: 0o600 }); fs.renameSync(tmp, lido.arquivo); }
    finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
    return { registrado: true, id, hash: hash(proximo) };
  }, [atual.arquivo]);
}

export function iniciarRegras(raiz, dirDados = path.join(raiz, 'vagas/data')) {
  const atual = lerRegras(raiz);
  if (atual.existe) return atual;
  return comEscritaCentral(dirDados, () => {
    const lido = lerRegras(raiz);
    if (!lido.existe) fs.writeFileSync(lido.arquivo, MODELO_REGRAS, { flag: 'wx', mode: 0o600 });
    return lerRegras(raiz);
  }, [atual.arquivo]);
}
