import { createHash } from 'node:crypto';
import { hashPacoteRespostas } from '../src/revisao-respostas.js';
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, sep, relative } from 'node:path';
import { validarBanco, validarCandidatura, modeloCandidatura, pacoteEditorialCandidatura } from '../src/respostas.js';
import { lerFontesInstalacao } from '../src/fontes-instalacao.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const ler = (caminho) => JSON.parse(readFileSync(caminho, 'utf8'));
// As fontes e o perfil pertencem à instalação; nenhum material do mantenedor.
const repo = resolve(raiz, '..');
function fonteAtual(papel, nome, caminhoRegistrado = nome) {
  const solicitado = resolve(raiz, nome);
  if (!solicitado.startsWith(repo + sep)) throw new Error('Fonte fora da instalação');
  let componente = repo;
  for (const parte of relative(repo, solicitado).split(sep)) {
    componente = resolve(componente, parte);
    if (lstatSync(componente).isSymbolicLink()) throw new Error('Fonte simbólica não permitida');
  }
  const caminho = realpathSync(solicitado);
  const info = lstatSync(caminho);
  if (!caminho.startsWith(realpathSync(repo) + sep) || !info.isFile() || info.nlink !== 1) throw new Error('Fonte insegura');
  return { papel, caminho: caminhoRegistrado, hash: createHash('sha256').update(readFileSync(caminho)).digest('hex') };
}
function fontesAtuais(candidatura) {
  const fontes = [
    fonteAtual('respostas', '../aplicacao/RESPOSTAS.md'),
    fonteAtual('perfil', '../aplicacao/PERFIL.md'),
    fonteAtual('escrita', '../Skills/review-escrita/SKILL.md'),
    fonteAtual('voz', candidatura.fonteVoz || '../Skills/review-escrita/SKILL.md'),
  ];
  for (const campo of candidatura.respostas || []) {
    const nome = typeof campo?.fonte === 'string' ? campo.fonte.split('#')[0] : '';
    if (!nome) throw new Error('Fonte factual ausente');
    if (!fontes.some(f => f.caminho === nome)) fontes.push(fonteAtual('fato', nome));
  }
  return fontes;
}
try {
  let resultado;
  if (args.length === 1 && args[0] === '--modelo') {
    console.log(JSON.stringify(modeloCandidatura(), null, 2));
  } else if (args.length === 2 && args[0] === '--preparar-revisao') {
    const candidatura = ler(resolve(args[1]));
    candidatura.fontesEscrita = fontesAtuais(candidatura);
    const pacoteRespostas = pacoteEditorialCandidatura(candidatura);
    console.log(JSON.stringify({ fontesEscrita: candidatura.fontesEscrita, pacoteRespostas,
      hashPacote: hashPacoteRespostas(pacoteRespostas), observacao: 'Sem aprovação. Despachar revisor independente conforme docs/revisor-respostas.md.' }, null, 2));
  } else if (args.length === 2 && args[0] === '--candidatura') {
    const candidatura = ler(resolve(args[1]));
    resultado = validarCandidatura(candidatura);
    if (candidatura.estado !== 'enviada' && candidatura.respostas?.length) {
      const fontes = fontesAtuais(candidatura);
      if (fontes.length !== candidatura.fontesEscrita?.length || fontes.some(f => !candidatura.fontesEscrita?.some(r => r.papel === f.papel && r.caminho === f.caminho && r.hash === f.hash))) {
        resultado.ok = false;
        resultado.erros.push('Fontes da instalação mudaram ou não foram consultadas. Prepare e revise novamente as respostas.');
      }
    }
  } else if (args.length === 0) {
    const fontes = lerFontesInstalacao();
    resultado = validarBanco(fontes.banco, fontes.perfil);
  } else {
    console.error('Uso: node scripts/validar-respostas.mjs [--modelo | --preparar-revisao caminho.json | --candidatura caminho.json]');
    process.exitCode = 2;
  }
  if (resultado) {
    console.log(JSON.stringify(resultado, null, 2));
    process.exitCode = resultado.ok ? 0 : 1;
  }
} catch {
  // Não imprimir trecho do JSON: o arquivo inválido pode conter dado privado.
  console.error('Não foi possível ler as fontes Markdown ou o JSON solicitado. Confira aplicacao/RESPOSTAS.md e aplicacao/PERFIL.md; migre JSON legado se o comando indicar.');
  process.exitCode = 2;
}
