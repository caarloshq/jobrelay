// Coordenação portátil. Os callbacks pertencem ao assistente e conservam os
// próprios gates. Este módulo não cria agentes, acessa websites ou libera envio.
export const FRENTES = Object.freeze(['coleta', 'aplicacao']);

export function normalizarFrentes(frentes = FRENTES) {
  if (!Array.isArray(frentes) || !frentes.length || new Set(frentes).size !== frentes.length ||
      frentes.some(f => !FRENTES.includes(f))) throw new Error('FRENTES_INVALIDAS');
  return FRENTES.filter(f => frentes.includes(f));
}

export function planejarFrentes({ frentes, modoCandidatura = 'mapear', capacidade = 4 } = {}) {
  if (!Number.isInteger(capacidade) || capacidade < 1 || capacidade > 4) throw new Error('CAPACIDADE_INVALIDA: informe de 1 a 4 posições operacionais disponíveis.');
  if (!['mapear', 'chrome_assistido'].includes(modoCandidatura)) throw new Error('MODO_CANDIDATURA_INVALIDO');
  const selecionadas = normalizarFrentes(frentes);
  const ativas = selecionadas.filter(f => f !== 'aplicacao' || modoCandidatura === 'chrome_assistido');
  return {
    selecionadas, ativas, capacidadeTotal: capacidade, maximoPorFrente: Math.min(2, capacidade),
    paralelo: false,
    ordem: ativas,
    exigeFechamentoColeta: ativas.includes('coleta') && ativas.includes('aplicacao'),
    aplicacaoBloqueada: selecionadas.includes('aplicacao') && modoCandidatura === 'mapear',
    navegador: { compartilhado: true, controladoresSimultaneos: 1, exigePosseExterna: true },
    papeis: {
      coleta: ['captura e integração', 'triagem sem navegador'],
      aplicacao: ['aplicador e preparação', 'revisor de candidatura'],
    },
    autorizaEnvio: false,
  };
}

// Fila FIFO entre tarefas elegíveis: uma frente saturada não bloqueia a outra.
export class CoordenadorFrentes {
  constructor(opcoes) {
    this.plano = planejarFrentes(opcoes);
    this.ativos = { coleta: 0, aplicacao: 0 };
    this.coletaFechada = false;
    this.coletaPronta = !this.plano.exigeFechamentoColeta;
    this.total = 0;
    this.fila = [];
    this.reservasNavegador = { coleta: 0, aplicacao: 0 };
    this.navegadorPendente = Promise.resolve();
  }
  executar(frente, trabalho) {
    if (!this.plano.ativas.includes(frente)) return Promise.reject(new Error('FRENTE_DESABILITADA'));
    if (frente === 'coleta' && this.coletaFechada) return Promise.reject(new Error('COLETA_JA_ENCERRADA'));
    if (frente === 'aplicacao' && !this.coletaPronta) return Promise.reject(new Error('COLETA_NAO_CONFERIDA'));
    if (typeof trabalho !== 'function') return Promise.reject(new Error('TRABALHO_INVALIDO'));
    return new Promise((resolve, reject) => {
      this.fila.push({ frente, trabalho, resolve, reject });
      this.despachar();
    });
  }
  concluirColeta(recibo) {
    if (this.reservasNavegador.coleta || this.ativos.coleta || this.fila.some(t => t.frente === 'coleta')) throw new Error('COLETA_AINDA_ATIVA');
    if (!recibo || recibo.localConfirmado !== true || recibo.destinoConfirmado !== true || recibo.arquivosOrganizados !== true ||
        typeof recibo.provaRef !== 'string' || !recibo.provaRef.trim()) throw new Error('FECHAMENTO_COLETA_OBRIGATORIO');
    this.coletaPronta = true;
    this.coletaFechada = true;
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
    if (!this.plano.ativas.includes(frente)) throw new Error('FRENTE_DESABILITADA');
    if (frente === 'coleta' && this.coletaFechada) throw new Error('COLETA_JA_ENCERRADA');
    if (frente === 'aplicacao' && !this.coletaPronta) throw new Error('COLETA_NAO_CONFERIDA');
    if (posseConfirmada !== true || typeof checkpointRef !== 'string' || !checkpointRef.trim()) throw new Error('NAVEGADOR_SEM_POSSE');
    if (typeof trabalho !== 'function') throw new Error('TRABALHO_INVALIDO');
    this.reservasNavegador[frente]++;
    const anterior = this.navegadorPendente;
    let liberar;
    this.navegadorPendente = new Promise(resolve => { liberar = resolve; });
    await anterior;
    try {
      if (frente === 'coleta' && this.coletaFechada) throw new Error('COLETA_JA_ENCERRADA');
      if (frente === 'aplicacao' && !this.coletaPronta) throw new Error('COLETA_NAO_CONFERIDA');
      return await trabalho();
    } finally { this.reservasNavegador[frente]--; liberar(); }
  }
}

/** Executa as frentes escolhidas em ordem. O callback coleta inclui gravação,
 * releitura, organização; devolve um recibo atestado.
 * Não recebe token principal. Auxiliares ocupam posições da própria frente.
 */
export async function executarFrentes(opcoes, { coletar, aplicar } = {}) {
  const coordenador = new CoordenadorFrentes(opcoes);
  for (const frente of coordenador.plano.ativas) {
    if (typeof ({ coleta: coletar, aplicacao: aplicar })[frente] !== 'function') throw new Error('EXECUTOR_AUSENTE:' + frente);
  }
  let coletaEncerrada = !coordenador.plano.ativas.includes('coleta');
  let erroColeta = null;
  const contexto = { coordenador, coletaEncerrada: () => coletaEncerrada, erroColeta: () => erroColeta };
  const resultados = [];
  for (const frente of coordenador.plano.ativas) {
    if (frente === 'aplicacao' && !coordenador.coletaPronta) {
      resultados.push({ frente, status: 'rejected', reason: new Error('COLETA_NAO_CONFERIDA') }); continue;
    }
    try {
      const value = await coordenador.executar(frente, () => ({ coleta: coletar, aplicacao: aplicar })[frente](contexto));
      if (frente === 'coleta') { coordenador.concluirColeta(value); coletaEncerrada = true; }
      resultados.push({ frente, status: 'fulfilled', value });
    } catch (reason) {
      if (frente === 'coleta') erroColeta = reason;
      resultados.push({ frente, status: 'rejected', reason });
    }
  }
  return { plano: coordenador.plano, resultados };
}
