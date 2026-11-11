// Preferências locais do onboarding. O agendamento pertence ao assistente,
// fora deste processo; este arquivo nunca cria tarefas nem chama a Apify.
import { join } from 'node:path';
import { lerEstado, salvarEstado } from './estado-central.js';

export const POLITICA_PADRAO = Object.freeze({
  ativa: false,
  intervaloHoras: 4,
  apifyMaximoPorDia: 1,
  modoCandidatura: 'mapear',
  atualizarAutomaticamente: true,
  frentes: Object.freeze(['coleta', 'aplicacao']),
});

function normalizarFrentes(frentes = ['coleta', 'aplicacao']) {
  if (!Array.isArray(frentes) || !frentes.length || frentes.some(f => !['coleta', 'aplicacao'].includes(f)) || new Set(frentes).size !== frentes.length) throw new Error('Escolha coleta, aplicação ou ambas.');
  return ['coleta', 'aplicacao'].filter(f => frentes.includes(f));
}

export function normalizarEscolhas(dados = {}) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('Escolhas inválidas.');
  if (!['local', 'notion'].includes(dados.fonteEstado)) throw new Error('Escolha quadro local ou Notion.');
  const databaseId = String(dados.databaseId ?? '').trim();
  if (dados.fonteEstado === 'notion' && databaseId && !(/^[0-9a-f]{32}$/i.test(databaseId) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(databaseId))) {
    throw new Error('Informe o ID de 32 caracteres da database do Notion. Não cole token.');
  }
  if (!['mapear', 'chrome_assistido'].includes(dados.modoCandidatura)) throw new Error('Escolha mapear ou configurar candidatura assistida no Chrome.');
  if (dados.atualizarAutomaticamente !== undefined && typeof dados.atualizarAutomaticamente !== 'boolean') throw new Error('Escolha se quer atualizar automaticamente.');
  if (typeof dados.autonomia !== 'boolean') throw new Error('Escolha se quer a rodada automática.');
  const frentes = normalizarFrentes(dados.frentes);
  const linkedinFeed = dados.linkedinFeed ?? false;
  if (typeof linkedinFeed !== 'boolean') throw new Error('Escolha se quer coletar o LinkedIn pelo navegador.');
  if (linkedinFeed && !frentes.includes('coleta')) throw new Error('A captura do LinkedIn exige a frente de coleta.');
  return {
    linkedinFeed,
    fonteEstado: dados.fonteEstado,
    databaseId: dados.fonteEstado === 'notion' ? databaseId.replaceAll('-', '') : null,
    politica: { atualizarAutomaticamente: dados.atualizarAutomaticamente !== false, frentes, ativa: dados.autonomia, intervaloHoras: 4, apifyMaximoPorDia: 1, modoCandidatura: dados.modoCandidatura },
  };
}

export function lerPolitica(dirDados) {
  const p = lerEstado(join(dirDados, 'politica-autonomia.json'), POLITICA_PADRAO);
  if (typeof p.ativa !== 'boolean' || p.intervaloHoras !== 4 || p.apifyMaximoPorDia !== 1 ||
      !['mapear', 'chrome_assistido'].includes(p.modoCandidatura)) throw new Error('POLITICA_AUTONOMIA_INVALIDA');
  p.frentes = normalizarFrentes(p.frentes);
  return p;
}

export function salvarPolitica(dirDados, politica) {
  const atual = lerPolitica(dirDados);
  Object.assign(atual, politica);
  salvarEstado(join(dirDados, 'politica-autonomia.json'), atual, dirDados);
  return atual;
}

export function instrucaoOnboarding({ fonteEstado, databaseId, politica, linkedinFeed = false }) {
  const fonte = fonteEstado === 'notion'
    ? (databaseId ? `Escolhi Notion como fonte de estado, database ID ${databaseId}. Consulte a database inteira e preserve o quadro local.` : 'Escolhi criar um quadro no Notion. Leia docs/modelo-notion/README.md e docs/modelo-notion/quadro.json. Use minha conexão Notion para criar a página Puxa Vagas e seu quadro a partir do bundle saneado, com um único exemplo fictício exemplo:vaga-001. Não copie dados, IDs ou páginas do mantenedor; o bundle local não depende de acesso ao Notion dele. Se houver mais de um destino possível, pergunte onde criar. Confira os 19 campos, quatro grupos, cinco visualizações e Confiança em porcentagem com barra; informe ajustes manuais quando a conexão não permitir configurar algum detalhe. Use logo oficial comprovado como ícone da página, sem capa; quando faltar fonte, registre a limitação no relatório técnico do assistente, sem preencher Pendência operacional, descartar a vaga ou bloquear candidatura. Não peça ID, link de database nem credencial no formulário. Depois de criar, registre o ID real em vagas/data/fonte-estado.json com cd vagas && npm run estado -- --fonte notion --database-id ID e importe um snapshot completo, excluindo o exemplo do ciclo operacional. Até essa configuração, a operação deve aguardar, preservando o quadro local.')
    : 'Escolhi o quadro local como fonte de estado.';
  const candidatura = politica.modoCandidatura === 'chrome_assistido'
    ? 'Quero configurar candidaturas assistidas no Chrome depois de revisar o perfil, as respostas e cada autorização necessária. Esta escolha não autoriza preenchimento ou envio irrestrito.'
    : 'Quero apenas mapear e avaliar vagas; não preencha nem envie candidaturas.';
  const autonomia = politica.ativa
    ? 'Depois de concluir o onboarding, crie no agendador nativo do assistente uma tarefa recorrente a cada 4 horas. Use vagas/RODADA-DIARIA.md como entrada do ciclo e siga coleta/README.md e aplicacao/README.md. Respeite no máximo uma execução da Apify por dia, mesmo com quatro ou mais rodadas. Mostre no chat a tarefa criada e seu próximo horário. Se o agendador não estiver disponível, entregue o prompt pronto no chat e informe que a tarefa ainda não foi criada. Ela depende de o computador e as conexões estarem disponíveis; não prometa execução com o computador desligado.'
    : 'Não crie tarefa recorrente; farei as rodadas manualmente.';
  return [
    'Quero concluir o onboarding do JobRelay. Leia AGENTS.md, ONBOARDING.md e rode `cd vagas && npm run onboarding`; não repergunte blocos marcados ok.',
    'Use Skills/adapt-resume/materiais-fonte/ para montar meu currículo base. Entreviste antes de escrever fatos e deixe o currículo para minha conferência. Ajuste vagas/config/palavras-chave.json à minha profissão. Depois rode `npm run onboarding -- --concluir`.',
    fonte,
    'Pergunte separadamente se quero respostas só nos Markdown locais (padrão) ou Markdown local + minha página Notion. Se eu escolher Notion, mantenha ambos em paralelo, confira as alterações e deixe divergências pendentes no campo afetado. Configure a preferência com npm run fonte:respostas; não peça token.',
    `Frentes escolhidas: ${normalizarFrentes(politica.frentes).join(' e ')}. Execute somente essas frentes, conforme vagas/COORDENACAO-FRENTES.md. Com ambas, conclua, salve e confira a coleta antes de aplicar. Escolher aplicação não autoriza envio irrestrito.`,
    linkedinFeed ? 'Quero testar a captura beta do LinkedIn como última fonte da coleta. Gere as consultas a partir dos meus cargos e da minha profissão confirmados, sem usar títulos de exemplo de outra pessoa. O Feed não oferece filtro por cargo. Para Vagas, Postagens e Feed, o login no LinkedIn é obrigatório: peça que eu entre no painel local, aguarde meu aviso e confira a sessão antes de iniciar ou contar atividade. Não peça credenciais nem faça login por mim. Percurso: Jobs 15 minutos, Postagens 12 minutos e Feed 3 minutos. Use somente o navegador autorizado e pare em bloqueios.' : 'Não ative captura assistida do LinkedIn.',
    candidatura,
    'Após a confirmação humana do formulário, leia docs/navegador.md. Explique que o navegador headless tem um perfil isolado desta instalação e acesso humano pelo painel local. Peça que eu entre no LinkedIn diretamente nesse painel. Para candidaturas Gupy, pergunte se quero configurar o acesso e sugira Entrar com LinkedIn somente se essa opção aparecer. Use npm run navegador -- diagnostico e npm run navegador -- login linkedin; mostre o urlAcessoHumano retornado e aguarde meu aviso, sem observar ou preencher o login. Só depois use npm run navegador -- retomar --confirmado-pela-pessoa e confira a página. Para Gupy, repita com login gupy. Não peça senha, código ou cookies no chat. Se o navegador não estiver disponível ou eu preferir adiar, informe a pendência e preserve a coleta pública que puder ocorrer sem login.',
    autonomia,
    politica.atualizarAutomaticamente !== false
      ? 'Quero verificar atualizações antes de iniciar cada rodada. Consulte as regras locais e a release estável original do GitHub; peça minha confirmação da versão antes de baixar e instalar pelo atualizador. Respeite conflitos, dados e bloqueios; nunca force uma atualização. Esta preferência não cria uma tarefa separada de checagem.'
      : 'Desativei a checagem de atualização antes das rodadas. Não consulte nem instale releases automaticamente nesse fluxo; atualizações manuais continuam disponíveis.',
    'Configure as conexões necessárias na sua própria conta ou ferramenta. Nunca peça credenciais em chat. Não inicie candidatura antes de concluir as confirmações do perfil.',
  ].join('\n\n');
}
export function lerLinkedinFeed(dirConfig) {
  return lerEstado(join(dirConfig, 'linkedin-feed.json'), { habilitado: false });
}

export function salvarLinkedinFeed(dirConfig, dirDados, habilitado) {
  if (typeof habilitado !== 'boolean') throw new Error('Escolha se quer coletar o feed do LinkedIn.');
  const atual = lerLinkedinFeed(dirConfig);
  atual.habilitado = habilitado;
  salvarEstado(join(dirConfig, 'linkedin-feed.json'), atual, dirDados);
}
