// Opt-in: run against an exact candidate commit prepared by the release coordinator.
// No fetch over the network, no checkout or mutation of the real installation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { atualizarAutomaticamente } from '../src/atualizacao.js';
import { criarSessaoFormulario } from '../src/onboarding-humano.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const candidate = process.env.JOBRELAY_TEST_UPGRADE_CANDIDATE;
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

test('v1.3.0 atualiza pelo updater real e preserva perfil, recibo, opt-out e configurações locais', { skip: !candidate }, async t => {
  assert.match(candidate, /^[a-f0-9]{40}$/);
  const dir = fs.mkdtempSync(path.join(repo, 'vagas/data/upgrade-release-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  execFileSync('git', ['clone', '--no-hardlinks', '--no-checkout', repo, dir], { stdio: 'pipe' });
  git(dir, 'fetch', '--no-tags', repo, candidate);
  git(dir, 'checkout', '-B', 'main', 'v1.3.0');
  git(dir, 'remote', 'set-url', 'origin', 'https://github.com/caarloshq/jobrelay.git');
  const dados = path.join(dir, 'vagas/data');
  fs.mkdirSync(dados, { recursive: true });
  fs.mkdirSync(path.join(dir, 'interface'), { recursive: true });
  const personal = {
    'vagas/config/perfil.json': JSON.stringify({ nome: 'Pessoa fictícia da fixture', _configurado: true }),
    'vagas/config/navegador.json': JSON.stringify({ versao: 1, transportePadrao: 'headless', agentBrowserVersion: '0.42.0', executavelChrome: '/fixture/chrome', portaAcessoHumano: 4855 }),
    'vagas/data/politica-autonomia.json': JSON.stringify({ ativa: false, intervaloHoras: 4, apifyMaximoPorDia: 1, modoCandidatura: 'mapear', atualizarAutomaticamente: false }),
    'vagas/data/quadro.json': JSON.stringify({ versao: 2, vagas: { 'ficticio:1': { status: 'Avaliar', historico: [] } } }),
    'interface/.env.local': 'JOBRELAY_PROTOTYPE_FILE=/fixture/quadro.json\n',
    'Skills/adapt-resume/materiais-fonte/README.md': 'Material pessoal fictício que a release não pode substituir.\n',
  };
  for (const [file, value] of Object.entries(personal)) fs.writeFileSync(path.join(dir, file), value);
  const form = criarSessaoFormulario(dados);
  for (let n = 1; n <= 7; n++) form.registrarPasso(n);
  form.confirmar(true);
  const receipt = fs.readFileSync(path.join(dados, 'onboarding-humano.json'));
  const before = Object.fromEntries(Object.keys(personal).map(file => [file, fs.readFileSync(path.join(dir, file))]));
  const result = await atualizarAutomaticamente({
    raiz: dir,
    consultarRelease: async () => ({ tag: 'v1.4.0', tagSha: candidate }),
    obterTag: async ({ ref }) => { git(dir, 'update-ref', ref, candidate); },
  });
  assert.equal(result.status, 'atualizado', JSON.stringify(result));
  assert.equal(git(dir, 'rev-parse', 'HEAD'), candidate);
  for (const [file, bytes] of Object.entries(before)) assert.deepEqual(fs.readFileSync(path.join(dir, file)), bytes, file);
  assert.deepEqual(fs.readFileSync(path.join(dados, 'onboarding-humano.json')), receipt);
  const guard = await import(pathToFileURL(path.join(dir, 'vagas/src/onboarding-humano.js')).href);
  const policy = await import(pathToFileURL(path.join(dir, 'vagas/src/onboarding-autonomia.js')).href);
  assert.doesNotThrow(() => guard.exigirOnboardingHumano(dados));
  assert.equal(policy.lerPolitica(dados).atualizarAutomaticamente, false);
  fs.unlinkSync(path.join(dados, 'onboarding-humano.json'));
  assert.throws(() => guard.exigirOnboardingHumano(dados), /ONBOARDING_HUMANO_OBRIGATORIO/);
});
