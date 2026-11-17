// Versão do produto dita ao atualizar (spec 015). Funções puras, mais uma consulta
// opcional à última release estável. Nada aqui instala, baixa código ou grava estado.
import fs from 'node:fs';
import path from 'node:path';

export const URL_ULTIMA_RELEASE = 'https://api.github.com/repos/caarloshq/jobrelay/releases/latest';
const ESTAVEL = /^\d+\.\d+\.\d+$/;
const INSTALADA = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const TAG = /^v(\d+\.\d+\.\d+)$/;
const um = v => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

/** Compara duas versões. Sufixo de pré-lançamento vale menos que a versão estável de mesmo número. */
export function compararVersoes(a, b) {
  const [baseA, preA] = String(a).split(/-(.+)/), [baseB, preB] = String(b).split(/-(.+)/);
  const pa = baseA.split('.').map(Number), pb = baseB.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  if (preA && !preB) return -1;
  if (!preA && preB) return 1;
  return 0;
}

/**
 * @param {object} e
 * @param {string|null} e.instalada versão instalada (vagas/package.json) ou null
 * @param {string|null} e.destino última release estável ou null quando a consulta falhou
 * @param {boolean} [e.adaptado] núcleo adaptado (instalação pessoal)
 * @param {boolean} [e.registrada] false quando a instalação adaptada ainda não registrou a versão
 * @param {'sem_atualizacao'|'bloqueado'|'desativada'|null} [e.evidencia] resultado do atualizador, quando existe
 * @param {string} [e.motivo] motivo do bloqueio, em uma linha
 * @param {boolean} [e.depois] mensagem de relato, depois de instalar
 * @returns {{estado: string, texto: string}}
 */
export function mensagemVersao({ instalada = null, destino = null, adaptado = false, registrada = true, evidencia = null, motivo = '', depois = false } = {}) {
  const inst = registrada && typeof instalada === 'string' && INSTALADA.test(instalada) ? instalada : null;
  const dest = typeof destino === 'string' && ESTAVEL.test(destino) ? destino : null;
  const pronto = (estado, texto) => ({ estado, texto });
  if (depois && inst && dest) {
    return adaptado
      ? pronto('depois_adaptado', `Núcleo adaptado da versão ${inst} para a versão ${dest}. O que é só da sua instalação foi preservado.`)
      : pronto('depois', `Atualizado: da versão ${inst} para a versão ${dest}.`);
  }
  if (!inst && !dest) return pronto('nada', 'Não consegui identificar a versão instalada nem consultar a última publicada. Nada foi alterado.');
  if (!inst) {
    return pronto(adaptado && !registrada ? 'nao_registrada' : 'sem_versao_instalada',
      adaptado && !registrada
        ? `A versão do núcleo ainda não foi registrada nesta instalação. A última versão publicada é a ${dest}.`
        : `Não consegui identificar a versão instalada. A última versão publicada é a ${dest}.`);
  }
  if (evidencia === 'desativada') return pronto('desativada', `Você está na versão ${inst}. A checagem de versão está desligada nas preferências desta instalação.`);
  if (!dest) return pronto('sem_consulta', `Você está na versão ${inst}, mas não consegui consultar a última versão agora. Isso não quer dizer que esteja em dia.`);
  if (evidencia === 'bloqueado') {
    return pronto('bloqueado', `Você está na versão ${inst}. A atualização para a ${dest} está bloqueada: ${um(motivo).replace(/[.\s]+$/, '') || 'motivo não informado'}. Nada foi alterado.`);
  }
  const cmp = compararVersoes(inst, dest);
  if (cmp < 0) {
    return adaptado
      ? pronto('atualizar_adaptado', `Seu núcleo está adaptado da versão ${inst}. A atualização leva para a versão ${dest}, mantendo o que é só da sua instalação.`)
      : pronto('atualizar', `Você está na versão ${inst}. A atualização leva para a versão ${dest}.`);
  }
  if (cmp > 0) return pronto('mais_nova', `Você está na versão ${inst}, mais nova que a última versão publicada (${dest}). Nada para atualizar.`);
  if (adaptado) return pronto('em_dia_adaptado', `Seu núcleo está adaptado da versão ${inst}, a mais recente. O que é só da sua instalação foi preservado.`);
  if (evidencia === 'sem_atualizacao') return pronto('em_dia', `Você já está na versão ${inst}, a mais recente. Nada para atualizar.`);
  return pronto('mesmo_numero', `Você está na versão ${inst}, a mesma da última publicada. O número sozinho não prova que os arquivos são os mesmos; a conferência é do atualizador.`);
}

/** Linha fixa que o assistente acrescenta quando há versão nova. */
export const PERGUNTA_ATUALIZAR = 'Quer atualizar agora? Nada é instalado sem o seu sim.';

/** Lê a versão do pacote e o registro do núcleo adaptado. `vagas` é a pasta vagas/ da instalação. */
export function lerVersaoInstalada(vagas) {
  let versao = null;
  try { versao = JSON.parse(fs.readFileSync(path.join(vagas, 'package.json'), 'utf8')).version ?? null; } catch { /* sem pacote legível */ }
  const arquivo = path.join(vagas, 'config', 'nucleo-publico.json');
  if (!fs.existsSync(arquivo)) return { versao, adaptado: false, registrada: true };
  let registro = null;
  try { registro = JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { /* registro ilegível */ }
  return { versao, adaptado: true, registrada: registro?.registrada === true };
}

/** Consulta a última release estável. Nunca lança: falha vira { ok: false }. Sem credencial, sem eco de URL ou erro. */
export async function consultarUltimaRelease({ fetch: buscar = globalThis.fetch, timeoutMs = 5000 } = {}) {
  if (typeof buscar !== 'function') return { ok: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.min(Math.max(Number(timeoutMs) || 5000, 1), 30000));
  try {
    const r = await buscar(URL_ULTIMA_RELEASE, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'jobrelay-verificar-versao' } });
    if (!r?.ok) return { ok: false };
    const dados = await r.json();
    const m = TAG.exec(String(dados?.tag_name ?? ''));
    if (!m || dados.draft !== false || dados.prerelease !== false) return { ok: false };
    return { ok: true, versao: m[1] };
  } catch { return { ok: false }; } finally { clearTimeout(timer); }
}
