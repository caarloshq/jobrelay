#!/usr/bin/env node
// JSON somente por arquivo/stdin. Não imprime conteúdo de pacotes nem respostas.
import fs from 'node:fs';
import { layout } from '../src/layout.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuracaoFeed } from '../src/linkedin-feed-config.js';
import { operarLote, resumoColeta, resumoAplicacao, resumoColeta2Fora, linhaProgressoAplicacao, resumoRodada } from '../src/rodada-lote.js';
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
  const textos = { resumo_rodada: resumoRodada, resumo_coleta: resumoColeta, resumo_aplicacao: resumoAplicacao, resumo_coleta2_fora: resumoColeta2Fora, progresso_aplicacao: linhaProgressoAplicacao, resumoRodada };
  if (Object.hasOwn(textos, acao)) {
    process.stdout.write(`${textos[acao](args)}\n`);
  } else {
    if (!dados) throw new Error('DADOS_OBRIGATORIOS');
    const raizVagas = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const locais = layout(path.resolve(raizVagas, '..'));
    const perfilCandidatura = lerJsonSeguro(path.join(locais.config, 'perfil-candidatura.json'), { autorizado: false });
    const politicaAutonomia = lerJsonSeguro(path.join(locais.dados, 'politica-autonomia.json'), { modoCandidatura: 'mapear' });
    // A coleta 2 existe só onde o LinkedIn assistido está ligado (config/linkedin-feed.json).
    if (acao === 'iniciar' && args.coleta2Habilitada === undefined) {
      args.coleta2Habilitada = configuracaoFeed().habilitado === true;
    }
    const resultado = operarLote(dados, acao, args, { modoCandidatura: politicaAutonomia.modoCandidatura,
      autorizadoCandidatura: perfilCandidatura.autorizado === true, consultarFila: () => args.filaAtual,
      gateEnvio: () => args.gateEnvio });
    // O gate atestado na entrada não comprova navegador, status externo ou Submit.
    const saida = acao === 'planejar' ? resultado : { rodadaId: resultado.rodadaId,
      ...(acao === 'coleta2_captura' && resultado.coleta2 ? { coleta2: resultado.coleta2 } : {}),
      ...(resultado.vaga ? { estado: resultado.vaga.estado, versao: resultado.vaga.versao, pacoteHash: resultado.vaga.pacote?.hash || null } : {}), liberadoSubmit: false };
    process.stdout.write(`${JSON.stringify({ ok: true, resultado: saida })}\n`);
  }
} catch (e) {
  // Apenas códigos do contrato; nunca ecoar JSON de entrada ou caminhos de erro.
  const codigo = /^[A-Z][A-Z0-9_]+$/.test(e.message) ? e.message : 'ENTRADA_OU_PERSISTENCIA_INVALIDA';
  process.stderr.write(`${JSON.stringify({ ok: false, erro: codigo })}\n`); process.exitCode = 1;
}
