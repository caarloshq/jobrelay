// Coordenação portátil. Os callbacks pertencem ao assistente e conservam os
// próprios gates. Este módulo não cria agentes, acessa websites ou libera envio.
export const FRENTES = Object.freeze(['coleta', 'aplicacao']);
// A coleta 2 (LinkedIn assistido, spec 015) é uma frente interna: não se escolhe na política.
const INTERNAS = Object.freeze([...FRENTES, 'coleta2']);
export const PERGUNTA_COLETA2 = 'Quer continuar com a coleta 2 (LinkedIn assistido)?';

export function normalizarFrentes(frentes = FRENTES) {
  if (!Array.isArray(frentes) || !frentes.length || new Set(frentes).size !== frentes.length ||
      frentes.some(f => !FRENTES.includes(f))) throw new Error('FRENTES_INVALIDAS');
  return FRENTES.filter(f => frentes.includes(f));
}

export function planejarFrentes({ frentes, modoCandidatura = 'mapear', capacidade = 4, origem = 'manual' } = {}) {
  if (!Number.isInteger(capacidade) || capacidade < 1 || capacidade > 4) throw new Error('CAPACIDADE_INVALIDA: informe de 1 a 4 posições operacionais disponíveis.');
  if (!['mapear', 'chrome_assistido'].includes(modoCandidatura)) throw new Error('MODO_CANDIDATURA_INVALIDO');
  if (!['manual', 'agendada'].includes(origem)) throw new Error('ORIGEM_INVALIDA');
  const selecionadas = normalizarFrentes(frentes);
  const ativas = selecionadas.filter(f => f !== 'aplicacao' || modoCandidatura === 'chrome_assistido');
  return {
    selecionadas, ativas, capacidadeTotal: capacidade, maximoPorFrente: Math.min(2, capacidade),
    paralelo: false,
    // Coleta principal primeiro; a aplicação vem depois dela (spec 015). Retomadas continuam antes das novas, dentro da aplicação.
    ordem: ativas,
    origem,
    coleta2: ativas.includes('coleta') ? { depoisDaAplicacao: true, exigeAceite: true, pergunta: PERGUNTA_COLETA2, semRespostaNaAgendada: true } : null,
    priorizaRetomadas: ativas.includes('aplicacao'),
    exigeConfirmacaoPorVaga: ativas.includes('aplicacao'),
    exigeFechamentoColeta: false,
    aplicacaoBloqueada: selecionadas.includes('aplicacao') && modoCandidatura === 'mapear',
    navegador: { compartilhado: true, controladoresSimultaneos: 1, exigePosseExterna: true },
    papeis: {
      coleta: ['captura e integração', 'triagem sem navegador'],
      aplicacao: ['aplicador e preparação', 'revisor de candidatura'],
    },
    autorizaEnvio: false,
  };
}

const reciboValido = recibo => Boolean(recibo) && recibo.localConfirmado === true && recibo.destinoConfirmado === true &&
  recibo.arquivosOrganizados === true && typeof recibo.provaRef === 'string' && recibo.provaRef.trim() !== '';
const respostaSim = r => r && typeof r === 'object' && r.decisao === 'sim' && typeof r.provaRef === 'string' && r.provaRef.trim() !== '';

// Fila FIFO entre tarefas elegíveis: uma frente saturada não bloqueia a outra.
export class CoordenadorFrentes {
  constructor(opcoes) {
    this.plano = planejarFrentes(opcoes);
    this.ativos = { coleta: 0, aplicacao: 0, coleta2: 0 };
    this.coletaFechada = false;
    this.coleta2Fechada = false;
    this.coleta2Aceite = null;
    this.coletaPronta = !this.plano.ativas.includes('coleta');
    this.total = 0;
    this.fila = [];
    this.reservasNavegador = { coleta: 0, aplicacao: 0, coleta2: 0 };
    this.navegadorPendente = Promise.resolve();
  }
  frenteAtiva(frente) {
    return INTERNAS.includes(frente) && (frente === 'coleta2' ? Boolean(this.plano.coleta2) : this.plano.ativas.includes(frente));
  }
  // A coleta 2 só começa depois que a principal fechou, e fecha uma vez, em separado.
  barrada(frente) {
    if (frente === 'coleta' && this.coletaFechada) return 'COLETA_JA_ENCERRADA';
    if (frente === 'coleta2' && this.coleta2Fechada) return 'COLETA2_JA_ENCERRADA';
    if (frente === 'coleta2' && !this.coletaFechada) return 'COLETA_PRINCIPAL_ABERTA';
    if (frente === 'coleta2' && !this.coleta2Aceite) return 'COLETA2_SEM_ACEITE';
    return null;
  }
  executar(frente, trabalho) {
    if (!this.frenteAtiva(frente)) return Promise.reject(new Error('FRENTE_DESABILITADA'));
    if (this.barrada(frente)) return Promise.reject(new Error(this.barrada(frente)));
    if (typeof trabalho !== 'function') return Promise.reject(new Error('TRABALHO_INVALIDO'));
    return new Promise((resolve, reject) => {
      this.fila.push({ frente, trabalho, resolve, reject });
      this.despachar();
    });
  }
  concluirColeta(recibo) {
    if (this.reservasNavegador.coleta || this.ativos.coleta || this.fila.some(t => t.frente === 'coleta')) throw new Error('COLETA_AINDA_ATIVA');
    if (!reciboValido(recibo)) throw new Error('FECHAMENTO_COLETA_OBRIGATORIO');
    this.coletaPronta = true;
    this.coletaFechada = true;
  }
  /** Registra o sim da pessoa. Sem ele a coleta 2 não executa nem pega o navegador. */
  autorizarColeta2(provaRef) {
    if (!this.coletaFechada) throw new Error('COLETA_PRINCIPAL_ABERTA');
    if (typeof provaRef !== 'string' || !provaRef.trim()) throw new Error('ACEITE_COLETA2_OBRIGATORIO');
    this.coleta2Aceite = provaRef.trim();
  }
  concluirColeta2(recibo) {
    if (!this.coletaFechada) throw new Error('COLETA_PRINCIPAL_ABERTA');
    if (this.reservasNavegador.coleta2 || this.ativos.coleta2 || this.fila.some(t => t.frente === 'coleta2')) throw new Error('COLETA2_AINDA_ATIVA');
    if (!reciboValido(recibo)) throw new Error('FECHAMENTO_COLETA2_OBRIGATORIO');
    this.coleta2Fechada = true;
  }
  despachar() {
    while (this.total < this.plano.capacidadeTotal) {
      const indice = this.fila.findIndex(t => this.ativos[t.frente] < this.plano.maximoPorFrente);
      if (indice < 0) return;
      const tarefa = this.fila.splice(indice, 1)[0];
      this.total++;
      this.ativos[tarefa.frente]++;
      (async () => {
        let valor, falha, rejeitada = false;
        try { valor = await tarefa.trabalho(); } catch (erro) { falha = erro; rejeitada = true; }
        this.total--;
        this.ativos[tarefa.frente]--;
        this.despachar();
        if (rejeitada) tarefa.reject(falha); else tarefa.resolve(valor);
      })();
    }
  }
  async comNavegador({ frente, posseConfirmada, checkpointRef }, trabalho) {
    if (!this.frenteAtiva(frente)) throw new Error('FRENTE_DESABILITADA');
    if (this.barrada(frente)) throw new Error(this.barrada(frente));
    if (posseConfirmada !== true || typeof checkpointRef !== 'string' || !checkpointRef.trim()) throw new Error('NAVEGADOR_SEM_POSSE');
    if (typeof trabalho !== 'function') throw new Error('TRABALHO_INVALIDO');
    this.reservasNavegador[frente]++;
    const anterior = this.navegadorPendente;
    let liberar;
    this.navegadorPendente = new Promise(resolve => { liberar = resolve; });
    await anterior;
    try {
      if (this.barrada(frente)) throw new Error(this.barrada(frente));
      return await trabalho();
    } finally { this.reservasNavegador[frente]--; liberar(); }
  }
}

/** Ordem da rodada (spec 015): coleta principal, aplicação (retomadas antes das novas), pergunta,
 * coleta 2 e, se a pessoa quiser, segunda passagem da aplicação só nas vagas da coleta 2.
 * Callbacks da coleta 2, todos opcionais:
 *  - coleta2Dispensada(ctx): motivo ('linkedin_desligado', 'ja_feita_hoje') ou null. Vem antes de qualquer pergunta.
 *  - perguntarColeta2(ctx): { decisao: 'sim' | 'nao', provaRef }. Ausente, ou rodada agendada: sem resposta.
 *  - coletar2(ctx): mesmo recibo de `coletar`.
 *  - perguntarAplicarNovas(ctx, n): { decisao, provaRef }. Só com `novasCompativeis` >= 1 no recibo da coleta 2, `aplicarNovasColeta2` e aplicação ativa.
 *  - aplicarNovasColeta2(ctx): trabalha somente nas vagas da coleta 2.
 * A coleta 2 nunca roda sem decisão 'sim' com provaRef. Não recebe token principal nem autoriza UI ou Submit.
 */
export async function executarFrentes(opcoes, { coletar, aplicar, coleta2Dispensada, perguntarColeta2, coletar2, perguntarAplicarNovas, aplicarNovasColeta2 } = {}) {
  const coordenador = new CoordenadorFrentes(opcoes);
  for (const frente of coordenador.plano.ativas) {
    if (typeof ({ coleta: coletar, aplicacao: aplicar })[frente] !== 'function') throw new Error('EXECUTOR_AUSENTE:' + frente);
  }
  const { plano } = coordenador;
  if (plano.coleta2 && typeof coletar2 !== 'function') throw new Error('EXECUTOR_AUSENTE:coleta2');
  let coletaEncerrada = !plano.ativas.includes('coleta');
  let erroColeta = null;
  const resultados = [];
  const contexto = etapa => ({ coordenador, etapa, somenteFilaConfirmada: true, coletaEncerrada: () => coletaEncerrada, erroColeta: () => erroColeta });
  const rodar = async (frente, etapa, executor) => {
    try {
      const value = await coordenador.executar(frente, () => executor(contexto(etapa)));
      if (frente === 'coleta') { coordenador.concluirColeta(value); coletaEncerrada = true; }
      if (frente === 'coleta2') coordenador.concluirColeta2(value);
      resultados.push({ frente, etapa, status: 'fulfilled', value });
      return true;
    } catch (reason) {
      if (frente === 'coleta') erroColeta = reason;
      resultados.push({ frente, etapa, status: 'rejected', reason });
      return false;
    }
  };
  let aplicacaoConcluida = !plano.ativas.includes('aplicacao');
  for (const frente of plano.ordem) {
    const ok = await rodar(frente, frente === 'coleta' ? 'coleta' : 'retomadas_e_novas_confirmadas', frente === 'coleta' ? coletar : aplicar);
    if (frente === 'aplicacao') aplicacaoConcluida = ok;
  }
  let coleta2 = null;
  if (plano.coleta2) {
    const fora = (motivo, estado = 'dispensada') => ({ estado, motivo });
    let motivoDispensa = null;
    try { motivoDispensa = typeof coleta2Dispensada === 'function' ? await coleta2Dispensada(contexto('coleta2')) : null; } catch { motivoDispensa = null; }
    if (motivoDispensa) coleta2 = fora(motivoDispensa);
    else if (!coletaEncerrada) coleta2 = fora('coleta_principal_nao_encerrada');
    else if (!aplicacaoConcluida) coleta2 = fora('aplicacao_nao_concluida');
    else if (plano.origem === 'agendada' || typeof perguntarColeta2 !== 'function') coleta2 = fora('sem_resposta', 'sem_resposta');
    else {
      let resposta = null;
      try { resposta = await perguntarColeta2(contexto('pergunta_coleta2')); } catch { resposta = null; }
      if (resposta && typeof resposta === 'object' && resposta.decisao === 'nao') coleta2 = fora('recusada', 'recusada');
      else if (!respostaSim(resposta)) coleta2 = fora('sem_resposta', 'sem_resposta');
      else {
        coordenador.autorizarColeta2(resposta.provaRef);
        const ok = await rodar('coleta2', 'coleta2', coletar2);
        coleta2 = { estado: ok ? 'encerrada' : 'impedida', aceiteRef: resposta.provaRef };
        // O recibo da coleta 2 informa quantas vagas compatíveis foram gravadas; sem nenhuma, não há o que perguntar.
        const n = ok ? resultados.at(-1).value?.novasCompativeis : 0;
        if (ok && Number.isSafeInteger(n) && n >= 1 && plano.ativas.includes('aplicacao') && typeof aplicarNovasColeta2 === 'function' && typeof perguntarAplicarNovas === 'function') {
          let segunda = null;
          try { segunda = await perguntarAplicarNovas(contexto('pergunta_aplicar_novas'), n); } catch { segunda = null; }
          if (respostaSim(segunda)) await rodar('aplicacao', 'novas_da_coleta2', aplicarNovasColeta2);
          else coleta2.novasAdiadas = true;
        }
      }
    }
  }
  return { plano, resultados, coleta2 };
}
