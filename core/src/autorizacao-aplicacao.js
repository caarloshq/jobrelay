// Opt-in público: somente configuração local explícita, sem frases pessoais do Perfil.
import path from 'node:path';
import { lerJsonSeguro } from './persistencia.js';

export function aplicacaoAutorizada(dirDados, dirConfig = path.join(dirDados, '..', 'config')) {
  try {
    const politica = lerJsonSeguro(path.resolve(dirDados, 'politica-autonomia.json'), null);
    const perfil = lerJsonSeguro(path.resolve(dirConfig, 'perfil-candidatura.json'), null);
    return politica?.modoCandidatura === 'chrome_assistido' && perfil?.autorizado === true;
  } catch { return false; }
}
