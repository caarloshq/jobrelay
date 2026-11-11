// Atualiza antes de importar módulos da rodada: a próxima importação usa a versão instalada.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lerRegras } from '../src/regras-projeto-leitura.js';
import { atualizarAutomaticamente, podeIniciarOperacao } from '../src/atualizacao.js';

const alvos = { rodada: '../src/coletar.js', apify: './apify.mjs', enriquecer: './enriquecer.mjs' };
const acao = process.argv[2];
if (!Object.hasOwn(alvos, acao)) throw new Error('ENTRADA_INVALIDA: use rodada, apify ou enriquecer.');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// A consulta é local e não importa o núcleo operacional.
const regras = lerRegras(raiz);
if (!regras.texto.trim()) throw new Error('REGRAS_VAZIAS');
// URL própria para a pré-checagem: a rodada importa a versão instalada após o update.
const { exigirOnboardingHumano } = await import('../src/onboarding-humano.js?preflight');
exigirOnboardingHumano(process.env.VAGAS_DIR_DADOS || path.join(raiz, 'vagas', 'data'));
// Ler só o toggle evita carregar o grafo operacional antigo no cache ESM.
const politicaPath = path.join(process.env.VAGAS_DIR_DADOS || path.join(raiz, 'vagas', 'data'), 'politica-autonomia.json');
let politica = {};
const stPolitica = fs.lstatSync(politicaPath, { throwIfNoEntry: false });
if (stPolitica) {
  if (!stPolitica.isFile() || stPolitica.isSymbolicLink() || stPolitica.nlink !== 1 || stPolitica.size > 128 * 1024) throw new Error('POLITICA_AUTONOMIA_INVALIDA');
  try { politica = JSON.parse(fs.readFileSync(politicaPath, 'utf8')); } catch { throw new Error('POLITICA_AUTONOMIA_INVALIDA'); }
  if (!politica || Array.isArray(politica) || typeof politica !== 'object' || (politica.atualizarAutomaticamente !== undefined && typeof politica.atualizarAutomaticamente !== 'boolean')) throw new Error('POLITICA_AUTONOMIA_INVALIDA');
}
const destinoDados = path.resolve(process.env.VAGAS_DIR_DADOS || path.join(raiz, 'vagas', 'data'));
const resultado = politica.atualizarAutomaticamente !== false && destinoDados !== path.join(raiz, 'vagas', 'data')
  ? { status: 'bloqueado', motivo: 'DADOS_OPERACAO_DIVERGENTES' }
  : politica.atualizarAutomaticamente === false
  ? { status: 'desativada', motivo: 'Preferência desta instalação' }
  : await atualizarAutomaticamente({ raiz });
console.log(`[Atualização: ${resultado.status}] ${resultado.tag || resultado.motivo || ''}`);
if (!podeIniciarOperacao(resultado)) {
  console.log(JSON.stringify(resultado));
  throw new Error('ATUALIZACAO_PENDENTE: confirme a release específica com atualizar antes de iniciar a operação, ou desative a checagem nas preferências.');
}
process.argv.splice(2, 1);
await import(alvos[acao]);
