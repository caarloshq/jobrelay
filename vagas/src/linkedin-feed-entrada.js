import { DIR_DADOS } from './config.js';
import { configuracaoFeed } from './linkedin-feed-config.js';
import { planejar } from './linkedin-feed-sessao.js';

/** Planeja a etapa assistida; não adquire navegador, não lê rede e não inicia o relógio. */
export function entradaFeed({ dirDados = DIR_DADOS, frente = 'coleta', fuso = process.env.VAGAS_FUSO || Intl.DateTimeFormat().resolvedOptions().timeZone,
  habilitado = configuracaoFeed().habilitado, agora } = {}) {
  const plano = planejar({ dirDados, frente, habilitado, fuso, agora });
  const instrucoes = {
    iniciar: 'Primeira coleta do dia: o agente deve obter a liberação do navegador autorizado e executar a captura assistida. Siga coleta/LINKEDIN-FEED.md.',
    retomar: 'Há captura parcial ou sob controle de outro dono. Consulte o status e retome somente após liberação explícita; não comece outra janela.',
    integrar: 'A captura já terminou. Retome triagem, deduplicação e confirmação da fila; não repita o scroll.',
    dispensar: 'A janela diária já foi integrada. Esta coleta não inicia outro bloco de feed.',
    desabilitada: 'Feed não habilitado nesta instalação ou frente de aplicação isolada.',
  };
  return { ...plano, assistida: true, navegadorReservado: false, instrucao: instrucoes[plano.acao] };
}
