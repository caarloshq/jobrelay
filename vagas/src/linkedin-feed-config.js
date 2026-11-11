// O opt-in desta instalação não é copiado pelo sincronizador.
import { join, resolve } from 'node:path';
import { lerJsonSeguro } from './persistencia.js';
import * as config from './config.js';

export function configuracaoFeed(dirConfig = config.DIR_CONFIG || (process.env.VAGAS_DIR_CONFIG ? resolve(process.env.VAGAS_DIR_CONFIG) : join(config.RAIZ, 'config'))) {
  const valor = lerJsonSeguro(join(dirConfig, 'linkedin-feed.json'), { habilitado: false });
  if (!valor || typeof valor !== 'object' || Array.isArray(valor) || typeof valor.habilitado !== 'boolean' ||
      Object.keys(valor).some(chave => chave !== 'habilitado')) {
    throw new Error('LINKEDIN_FEED_CONFIG_INVALIDA: use somente {"habilitado": true ou false}.');
  }
  return valor;
}
