// Prova de que o repositório continua público de verdade.
//
//   npm run checar:publico
//
// Duas checagens, e as duas FALHAM o comando (exit 1), porque rodam no CI:
//
//   1. Nenhum arquivo versionável carrega dado de quem construiu o projeto,
//      nem de quem está usando. A lista de padrões abaixo começou com o que
//      vazou no primeiro export (2026-09-14: 7 arquivos, 11 menções) e cresce
//      toda vez que algo passar.
//   2. Todo script do package.json aponta para um arquivo que existe. No
//      primeiro export, 7 comandos apontavam para o nada, e ninguém viu até
//      alguém rodar `npm run doctor` numa máquina limpa.
//
// Examina o que o Git pode publicar, inclusive exceções versionáveis em `data/`.
// Arquivos ignorados (como `.env` e saídas pessoais) ficam fora da leitura.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { RAIZ } from '../src/config.js';

const REPO = resolve(RAIZ, '..');

/** Padrões que denunciam dado pessoal. Case-insensitive. */
const PADROES = [
  /carlos/i, /amfi/i, /caarloshq/i, /carloshq/i,
  /62621f24/i,            // id da base do Notion do autor
  /florian[oó]polis/i,    // cidade do autor, usada como exemplo em regra
  /carlosxpd9/i,
  /henrique/i, /nogueira/i, /dos santos/i, // sobrenomes do autor: o anonimizador trocava so o primeiro nome
  /so\+ma/i,
  /\$1\.18B/,
  // Telefone brasileiro real. O exemplo ficticio do base_content e todo zero.
  /\+55\s*\(?\d{2}\)?\s*9?\s*(?!0{4}-?0{4})\d{4}-?\d{4}/,
  // CPF. O unico permitido e o numero de teste classico 123.456.789-00.
  /\b(?!123\.456\.789-00)\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
];

// Só endereços completos do projeto podem conter o nome da conta pública.
// O URL antigo continua válido para instalações feitas antes da renomeação.
const URLS_PUBLICAS = new Set([
  'https://github.com/caarloshq/jobrelay',
  'https://github.com/caarloshq/jobrelay.git',
  'https://github.com/caarloshq/job-scrapper.git',
  'https://api.github.com/repos/caarloshq/jobrelay',
]);
const URL_HTTPS = /(^|[\s('"`])https:\/\/[^\s'"`<>),\]}]+/g;
function omitirUrlPublica(linha) {
  return linha.replace(URL_HTTPS, (trecho, prefixo) => {
    const candidato = trecho.slice(prefixo.length);
    const url = candidato.replace(/[.,;:!?]+$/, '');
    return prefixo + (URLS_PUBLICAS.has(url) ? 'REPOSITORIO_PUBLICO' : candidato);
  });
}

// README, LICENSE, PRODUCT.md e DESIGN.md citam o autor de proposito (credito, licenca e
// origem das decisoes de produto e de design). O resto do repositorio, nao.
const IGNORAR_ARQ = new Set(['.env', 'checar-publico.mjs', '.DS_Store', 'README.md', 'LICENSE', 'PRODUCT.md', 'DESIGN.md']);
const EXTENSOES = /\.(js|mjs|json|md|py|html|css|txt|yml|yaml|example)$/;

function listarVersionaveis() {
  // --cached inclui arquivos ja rastreados mesmo quando uma regra de ignore os
  // alcança; --others inclui novas edições que poderiam entrar no proximo commit.
  const nomes = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter(Boolean);
  return [...new Set(nomes)]
    .filter((nome) => !IGNORAR_ARQ.has(nome.split('/').at(-1)) && EXTENSOES.test(nome))
    .map((nome) => join(REPO, nome))
    .filter(existsSync);
}

let problemas = 0;

console.log('\nChecagem de repositório público\n' + '='.repeat(52) + '\n\n1. Dado pessoal em arquivo versionável');
for (const arq of listarVersionaveis()) {
  const linhas = readFileSync(arq, 'utf8').split('\n');
  linhas.forEach((l, i) => {
    for (const p of PADROES) {
      if (p.test(omitirUrlPublica(l))) {
        problemas++;
        console.log(`  ${relative(REPO, arq)}:${i + 1}  ${p}  ${l.trim().slice(0, 80)}`);
        break;
      }
    }
  });
}
if (!problemas) console.log('  nenhum. ok');

// Fontes de candidatura versionáveis precisam permanecer modelos neutros no
// repositório público. O histórico literal começa vazio e não pode ser publicado.
const MODELOS_NEUTROS = {
  'aplicacao/RESPOSTAS.md': '5f1db62462398ffc07a3b8e0b360ea1532701f158dbc9abb27e8fd7dc7e0bf4a',
  'aplicacao/PERFIL.md': 'd45db3d7cf7bc146ec3022790ff1ae46e95f30fa93cb7763c4057957e7e44a99',
  'vagas/data/perguntas.json': '3b35f5b85d841fc195b01e9bb2ee0d1605a5dd2df9d154e7423ea67b02abe874',
  'vagas/config/perfil-candidatura.json': '29c9066fd809dc02630ff7cf68003385dc1df784711a5b9cd90600bbd0abc9fc',
};
for (const [nome, esperado] of Object.entries(MODELOS_NEUTROS)) {
  const alvo = join(REPO, nome);
  if (!existsSync(alvo)) continue; // fixtures do teste não trazem a instalação completa
  const atual = createHash('sha256').update(readFileSync(alvo)).digest('hex');
  if (atual !== esperado) {
    problemas++;
    console.log('  ' + nome + ' contém edição local; publique somente o modelo neutro');
  }
}
const historico = join(REPO, 'aplicacao/RESPOSTAS-PREENCHIDAS.md');
if (existsSync(historico) && readFileSync(historico).length !== 0) {
  problemas++;
  console.log('  aplicacao/RESPOSTAS-PREENCHIDAS.md contém histórico; não publique respostas preenchidas');
}

console.log('\n2. Scripts do package.json apontando para arquivo que existe');
const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
let quebrados = 0;
for (const [nome, cmd] of Object.entries(pkg.scripts)) {
  const m = cmd.match(/(scripts\/[\w.-]+\.mjs|src\/[\w.-]+\.js|\.\.\/Skills\/[\w./-]+)/);
  if (!m) continue;
  const alvo = join(RAIZ, m[1]);
  if (!existsSync(alvo)) {
    quebrados++;
    console.log(`  npm run ${nome}  ->  ${m[1]}  NAO EXISTE`);
  }
}
if (!quebrados) console.log(`  ${Object.keys(pkg.scripts).length} scripts, todos resolvem. ok`);

console.log('\n' + '='.repeat(52));
if (problemas || quebrados) {
  console.log(`\nFALHOU: ${problemas} menção(ões) pessoal(is), ${quebrados} script(s) quebrado(s).\n`);
  process.exit(1);
}
console.log('\nRepositório limpo.\n');
