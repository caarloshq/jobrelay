#!/usr/bin/env node
// JSON somente por arquivo/stdin. Não imprime conteúdo de pacotes nem respostas.
import fs from 'node:fs';
import path from 'node:path';
import { operarLote, resumoColeta, resumoAplicacao, linhaProgressoAplicacao } from '../src/rodada-lote.js';
import { lerJsonSeguro } from '../src/persistencia.js';

try {
  const argv = process.argv.slice(2), acao = argv.shift();
  let dados = process.env.VAGAS_DIR_DADOS, entrada;
  while (argv.length) {
    const nome = argv.shift(), valor = argv.shift();
    if (!valor || !['--dados', '--arquivo'].includes(nome)) throw new Error('ARGUMENTO_INVALIDO');
    if (nome === '--dados') dados = valor;
    else { if (entrada) throw new Error('ENTRADA_DUPLICADA'); entrada = valor; }
  }
  const args = entrada ? lerJsonSeguro(path.resolve(entrada)) : JSON.parse(fs.readFileSync(0, 'utf8'));
  if (!args || Array.isArray(args) || typeof args !== 'object') throw new Error('ENTRADA_INVALIDA');
  const textos = { resumo_coleta: resumoColeta, resumo_aplicacao: resumoAplicacao, progresso_aplicacao: linhaProgressoAplicacao };
  if (Object.hasOwn(textos, acao)) {
    process.stdout.write(`${textos[acao](args)}\n`);
  } else {
    if (!dados) throw new Error('DADOS_OBRIGATORIOS');
    const resultado = operarLote(dados, acao, args, { consultarFila: () => args.filaAtual,
      gateEnvio: () => args.gateEnvio });
    // O gate atestado na entrada não comprova navegador, status externo ou Submit.
    const saida = acao === 'planejar' ? resultado : { rodadaId: resultado.rodadaId,
      ...(resultado.vaga ? { estado: resultado.vaga.estado, versao: resultado.vaga.versao, pacoteHash: resultado.vaga.pacote?.hash || null } : {}), liberadoSubmit: false };
    process.stdout.write(`${JSON.stringify({ ok: true, resultado: saida })}\n`);
  }
} catch (e) {
  // Apenas códigos do contrato; nunca ecoar JSON de entrada ou caminhos de erro.
  const codigo = /^[A-Z][A-Z0-9_]+$/.test(e.message) ? e.message : 'ENTRADA_OU_PERSISTENCIA_INVALIDA';
  process.stderr.write(`${JSON.stringify({ ok: false, erro: codigo })}\n`); process.exitCode = 1;
}
