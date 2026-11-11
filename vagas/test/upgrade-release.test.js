// Opt-in: ensaio offline entre a última release estável anterior e o commit exato da candidata.
// A base sai das tags alcançáveis pelo candidato com versão menor; JOBRELAY_TEST_UPGRADE_BASE força outra.
// Repositórios e arquivos ZIP são locais; nenhuma instalação real é alterada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { atualizarAutomaticamente } from '../src/atualizacao.js';
import { lerZip, permitidoZip } from '../src/atualizacao-zip.js';
import { criarSessaoFormulario } from '../src/onboarding-humano.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const candidate = process.env.JOBRELAY_TEST_UPGRADE_CANDIDATE;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const versaoDe = ref => JSON.parse(execFileSync('git', ['-C', repo, 'show', `${ref}:vagas/package.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).version;
const numeros = v => v.split('.').map(Number);
const menor = (a, b) => { const [x, y] = [numeros(a), numeros(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
function planoUpgrade() {
  if (!candidate) return { motivo: 'defina JOBRELAY_TEST_UPGRADE_CANDIDATE para ensaiar a atualização' };
  const versao = versaoDe(candidate);
  const anteriores = git(repo, 'tag', '--merged', candidate, '--list', 'v*').split('\n')
    .filter(t => /^v\d+\.\d+\.\d+$/.test(t) && menor(t.slice(1), versao))
    .sort((a, b) => menor(a.slice(1), b.slice(1)) ? 1 : -1);
  const base = process.env.JOBRELAY_TEST_UPGRADE_BASE || anteriores[0];
  if (!base) return { motivo: `nenhuma release estável anterior à ${versao} para servir de base` };
  return { base, versaoBase: versaoDe(base), tag: `v${versao}`, versao, motivo: false };
}
const plano = planoUpgrade();
const { base, versaoBase, tag, versao } = plano;
const archive = ref => execFileSync('git', ['-C', repo, 'archive', '--format=zip', '--prefix=jobrelay/', ref], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
function pasta(t, tipo) {
  assert.match(candidate, /^[a-f0-9]{40}$/);
  assert.equal(git(repo, 'rev-parse', `${candidate}^{commit}`), candidate);
  const dir = fs.mkdtempSync(path.join(repo, `vagas/data/upgrade-${tipo}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function personalizar(dir) {
  const personal = {
    'vagas/config/perfil.json': JSON.stringify({ nome: 'Pessoa fictícia da fixture', _configurado: true }),
    'vagas/config/navegador.json': JSON.stringify({ versao: 1, transportePadrao: 'headless', agentBrowserVersion: '0.42.0', executavelChrome: '/fixture/chrome', portaAcessoHumano: 4855 }),
    'vagas/data/politica-autonomia.json': JSON.stringify({ ativa: false, intervaloHoras: 4, apifyMaximoPorDia: 1, modoCandidatura: 'mapear', atualizarAutomaticamente: false }),
    'vagas/data/quadro.json': JSON.stringify({ versao: 2, vagas: { 'ficticio:1': { status: 'Avaliar', historico: [] } } }),
    'vagas/data/historico-fixture.json': JSON.stringify({ prova: 'histórico fictício preservado' }),
    'interface/.env.local': 'JOBRELAY_PROTOTYPE_FILE=/fixture/quadro.json\n',
    'Skills/adapt-resume/materiais-fonte/README.md': 'Material pessoal fictício que a release não pode substituir.\n',
    'REGRAS-DO-PROJETO.md': '# Regras locais fictícias\n\nNão alterar esta orientação na atualização.\n',
    'REGRAS-DO-PROJETO.md.bak': '# Regras anteriores fictícias\n',
    'aplicacao/PERFIL.md': '# Perfil local fictício\n',
    'aplicacao/RESPOSTAS.md': '# Respostas locais fictícias\n',
  };
  for (const [file, value] of Object.entries(personal)) { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), value); }
  const dados = path.join(dir, 'vagas/data');
  const form = criarSessaoFormulario(dados);
  for (let n = 1; n <= 7; n++) form.registrarPasso(n);
  form.confirmar(true);
  const arquivos = [...Object.keys(personal), 'vagas/data/onboarding-humano.json'];
  return Object.fromEntries(arquivos.map(file => [file, hash(fs.readFileSync(path.join(dir, file)))]));
}
async function conferirPreservados(dir, antes) {
  for (const [file, sha256] of Object.entries(antes)) assert.equal(hash(fs.readFileSync(path.join(dir, file))), sha256, file);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'vagas/package.json'))).version, versao);
  const dados = path.join(dir, 'vagas/data');
  const guard = await import(pathToFileURL(path.join(dir, 'vagas/src/onboarding-humano.js')).href);
  const policy = await import(pathToFileURL(path.join(dir, 'vagas/src/onboarding-autonomia.js')).href);
  assert.doesNotThrow(() => guard.exigirOnboardingHumano(dados));
  assert.equal(policy.lerPolitica(dados).atualizarAutomaticamente, false);
  fs.unlinkSync(path.join(dados, 'onboarding-humano.json'));
  assert.throws(() => guard.exigirOnboardingHumano(dados), /ONBOARDING_HUMANO_OBRIGATORIO/);
}

test('Git da release anterior instala a candidata e preserva dados, regras, recibo e opt-out', { skip: plano.motivo }, async t => {
  const dir = pasta(t, 'git');
  execFileSync('git', ['clone', '--no-hardlinks', '--no-checkout', repo, dir], { stdio: 'pipe' });
  git(dir, 'fetch', '--no-tags', repo, candidate);
  git(dir, 'checkout', '-B', 'main', base);
  git(dir, 'remote', 'set-url', 'origin', 'https://github.com/caarloshq/jobrelay.git');
  const antes = personalizar(dir); let buscas = 0;
  const opcoes = { raiz: dir, consultarRelease: async () => ({ tag, tagSha: candidate }),
    obterTag: async ({ ref }) => { buscas++; git(dir, 'update-ref', ref, candidate); } };
  assert.equal((await atualizarAutomaticamente(opcoes)).status, 'aguardando_confirmacao');
  assert.equal(buscas, 0);
  const result = await atualizarAutomaticamente({ ...opcoes, confirmacao: { aceita: true, tag, tagSha: candidate } });
  assert.equal(result.status, 'atualizado', JSON.stringify(result));
  assert.equal(git(dir, 'rev-parse', 'HEAD'), candidate);
  assert.equal((await atualizarAutomaticamente(opcoes)).status, 'sem_atualizacao');
  assert.equal(buscas, 1);
  await conferirPreservados(dir, antes);
});

test('ZIP da release anterior instala o archive real da candidata e repete sem download', { skip: plano.motivo }, async t => {
  const dir = pasta(t, 'zip');
  // Os bytes são exatamente git archive da base e do commit fornecido, sem overlays.
  for (const entrada of lerZip(archive(base))) {
    const destino = path.join(dir, entrada.nome); fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, entrada.conteudo, { mode: entrada.modo });
  }
  const antes = personalizar(dir), bytes = archive(candidate), assetSha256 = hash(bytes);
  const entradas = lerZip(bytes);
  assert.equal(permitidoZip('interface/tsconfig.json'), true);
  const tsconfig = entradas.find(e => e.nome === 'interface/tsconfig.json'); assert.ok(tsconfig, 'o pacote real inclui tsconfig');
  const release = { tag, tagSha: candidate, assetSha256, assetUrl: `${REPO_PUBLICO}/releases/download/${tag}/jobrelay.zip` };
  let downloads = 0;
  const opcoes = { raiz: dir, consultarRelease: async () => release,
    fetchImpl: async url => { assert.equal(url, release.assetUrl); downloads++; return { ok: true, status: 200, url, headers: new Headers(), body: new Blob([bytes]).stream() }; } };
  const preflight = await atualizarAutomaticamente(opcoes);
  assert.equal(preflight.status, 'aguardando_confirmacao'); assert.equal(downloads, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'vagas/package.json'))).version, versaoBase);
  const result = await atualizarAutomaticamente({ ...opcoes, confirmacao: { aceita: true, ...preflight.confirmacao_necessaria } });
  assert.equal(result.status, 'atualizado', JSON.stringify(result)); assert.equal(downloads, 1);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'interface/tsconfig.json')), tsconfig.conteudo);
  const manifesto = JSON.parse(fs.readFileSync(path.join(dir, 'vagas/data/atualizacao-instalacao.json')));
  assert.equal(manifesto.assetSha256, assetSha256); assert.equal(manifesto.tagSha, candidate);
  assert.ok(manifesto.arquivos.some(e => e.nome === 'interface/tsconfig.json'));
  assert.equal((await atualizarAutomaticamente(opcoes)).status, 'sem_atualizacao'); assert.equal(downloads, 1);
  await conferirPreservados(dir, antes);
});
const REPO_PUBLICO = 'https://github.com/caarloshq/jobrelay';
