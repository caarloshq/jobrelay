// Controle otimista complementa a exclusão: uma cópia lida antes de outra
// gravação não pode substituir silenciosamente a versão mais nova.
import { basename, dirname } from 'node:path';
import { lerJsonComHash, gravarJsonAtomico } from './persistencia.js';
import { comEscritaCentral } from './operacao.js';
import { arquivoDoQuadro, gravarAparicoesFichas, lerFichas, salvarQuadroEmFichas, usaFichas } from './fichas-vagas.js';

const versoes = new WeakMap();
export function lerEstado(arquivo, inicial) {
  const fichas = arquivoDoQuadro(arquivo) && usaFichas(dirname(arquivo));
  const { quadro: dados, hash } = fichas
    ? lerFichas(dirname(arquivo))
    : (() => {
      const estado = lerJsonComHash(arquivo, inicial);
      return { quadro: estado.dados, hash: estado.hash };
    })();
  if (dados && typeof dados === 'object') versoes.set(dados, { arquivo, hash });
  return dados;
}

export function herdarVersao(origem, destino) {
  if (versoes.has(origem)) versoes.set(destino, { ...versoes.get(origem) });
  return destino;
}

export function copiarEstado(origem) {
  return herdarVersao(origem, structuredClone(origem));
}

export function salvarEstado(arquivo, dados, dirDados = dirname(arquivo), transformar = x => x) {
  return comEscritaCentral(dirDados, () => {
    const versao = versoes.get(dados);
    const fichas = arquivoDoQuadro(arquivo) && usaFichas(dirDados);
    const atual = fichas ? lerFichas(dirDados).hash : lerJsonComHash(arquivo, null).hash;
    if ((!versao && atual !== null) || (versao && (versao.arquivo !== arquivo || versao.hash !== atual))) {
      throw new Error('Conflito de versão: recarregue o estado antes de salvar.');
    }
    const valor = transformar(dados);
    if (basename(arquivo) === 'historico.json' && usaFichas(dirDados)) gravarAparicoesFichas(dirDados, valor.vagas);
    const hash = fichas ? salvarQuadroEmFichas(dirDados, valor, atual) : gravarEstadoJson(arquivo, valor);
    if (dados && typeof dados === 'object') versoes.set(dados, { arquivo, hash });
    return arquivo;
  }, [arquivo]);
}


function gravarEstadoJson(arquivo, valor) {
  gravarJsonAtomico(arquivo, valor);
  return lerJsonComHash(arquivo, null).hash;
}
