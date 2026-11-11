// Atualiza antes de importar módulos da rodada: a próxima importação usa a versão instalada.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerPolitica } from '../src/onboarding-autonomia.js';
import { atualizarAutomaticamente } from '../src/atualizacao.js';

const alvos = { rodada: '../src/coletar.js', apify: './apify.mjs', enriquecer: './enriquecer.mjs' };
const acao = process.argv[2];
if (!Object.hasOwn(alvos, acao)) throw new Error('ENTRADA_INVALIDA: use rodada, apify ou enriquecer.');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// URL própria para a pré-checagem: a rodada importa a versão instalada após o update.
const { exigirOnboardingHumano } = await import('../src/onboarding-humano.js?preflight');
exigirOnboardingHumano(process.env.VAGAS_DIR_DADOS || path.join(raiz, 'vagas', 'data'));
const politica = lerPolitica(process.env.VAGAS_DIR_DADOS || path.join(raiz, 'vagas', 'data'));
const resultado = politica.atualizarAutomaticamente === false
  ? { status: 'desativada', motivo: 'Preferência desta instalação' }
  : await atualizarAutomaticamente({ raiz });
console.log(`[Atualização: ${resultado.status}] ${resultado.tag || resultado.motivo || ''}`);
if (resultado.trava === 'revisao_necessaria' || resultado.registro === 'falhou' ||
    (resultado.status === 'bloqueado' && ['ATUALIZACAO_OCUPADA', 'ATUALIZACAO_APLICACAO_INCERTA', 'OPERACAO_OCUPADA', 'ESTADO_OPERACAO_INVALIDO', 'TRAVA_MUDOU'].includes(resultado.motivo))) {
  throw new Error('OPERACAO_OCUPADA: aguarde ou reconcilie a operação anterior antes de rodar.');
}
process.argv.splice(2, 1);
await import(alvos[acao]);
