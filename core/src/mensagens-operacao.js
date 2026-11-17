// Texto humano compartilhado. Evidências são fornecidas pelo chamador; este módulo não executa ações.
const FIXAS = Object.freeze({
  download_concluido: '📦 Download concluído. Vou conferir os arquivos e preparar a instalação.',
  instalacao_concluida: '✅ Instalação concluída. O próximo passo é configurar o JobRelay.',
  onboarding_inicio: '👋 Vamos configurar sua profissão, suas preferências, seu currículo e onde você quer acompanhar as vagas. Você também vai escolher se autoriza o envio do seu currículo.',
  configuracao_salva: '📝 Configuração salva. Confira o resumo e confirme se posso começar.',
  configuracao_confirmada: '✅ Configuração confirmada. O JobRelay está pronto para a primeira coleta.',
  coleta_inicio: '🔎 Coleta iniciada. Vou buscar vagas, avaliar a aderência ao seu perfil e remover duplicatas.',
  envios_inicio: '📨 Vou começar os envios para as vagas autorizadas. Primeiro, vou retomar as pendências que possam avançar e depois seguir com as novas oportunidades.',
  pendencia_pessoal: '⏸️ Esta vaga depende de uma ação sua. Registrei a pendência e vou continuar com as outras vagas.',
  contatos_final: '💬 Há mensagens e e-mails preparados para sua revisão.\n\nVou apresentar cada texto separadamente, com o destinatário e o contexto, para você escolher o que autoriza enviar.',
  update_pendente: '⏳ Os arquivos da atualização foram instalados. A verificação final ainda está pendente. A atualização só estará concluída após essa conferência.',
});
const falhar = codigo => { throw new Error(codigo); };
const linha = valor => typeof valor === 'string' && valor.trim() && !/[\r\n\u0000-\u001f]/.test(valor) ? valor.trim() : falhar('CAMPO_MENSAGEM_INVALIDO');
export function formatarMensagemOperacao(evento, contexto = {}) {
  if (Object.hasOwn(FIXAS, evento)) return FIXAS[evento];
  if (evento === 'envios_fim') return contexto.pendentes
    ? '✅ Terminei esta etapa de envio para vagas.\n\nAs vagas que dependem de alguma ação sua continuam salvas como pendentes. Elas serão retomadas quando houver o que falta.'
    : '✅ Terminei os envios para as vagas autorizadas. Os resultados estão registrados no quadro.';
  if (evento === 'pendencia_video') return `⏸️ A vaga da ${linha(contexto.empresa)} exige um vídeo pessoal. A pendência ficou salva e vou continuar com as outras vagas.\n\nRetomamos essa vaga quando o vídeo estiver disponível.`;
  if (evento === 'envio_confirmado') {
    if (contexto.recebimentoConfirmado !== true) falhar('PROVA_ENVIO_AUSENTE');
    let texto = `✅ Sua inscrição para ${linha(contexto.cargo)} na ${linha(contexto.empresa)} foi recebida.`;
    if (contexto.registroAtualizado === true && contexto.abaFechada === true) texto += ' O registro foi atualizado e a aba da vaga foi fechada.';
    else if (contexto.registroAtualizado === true) texto += ' O registro foi atualizado.';
    else if (contexto.abaFechada === true) texto += ' A aba da vaga foi fechada.';
    return texto;
  }
  if (evento === 'update_confirmado') {
    if (contexto.posChecagemConfirmada !== true || contexto.dadosPreservados !== true) falhar('POS_CHECAGEM_AUSENTE');
    if (typeof contexto.nota !== 'string' || !contexto.nota.trim()) falhar('NOTA_RELEASE_AUSENTE');
    const versao = linha(contexto.versao);
    if (!/^\d+\.\d+\.\d+$/.test(versao)) falhar('VERSAO_INVALIDA');
    const bloco = contexto.nota.split('\n').map(linha => `> ${linha}`).join('\n');
    return `✅ **Atualização concluída!**\n\nVocê está na versão **${versao}**. Seus dados e suas escolhas foram preservados.\n\n> **NOTA DE RELEASE**\n>\n${bloco}\n\nPode continuar de onde parou.`;
  }
  falhar('EVENTO_MENSAGEM_INVALIDO');
}
