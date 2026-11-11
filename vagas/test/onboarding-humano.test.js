import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { concluido, exigirOnboardingHumano, criarSessaoFormulario } from '../src/onboarding-humano.js';
const pasta = () => mkdtempSync(join(tmpdir(), 'onboarding-sintetico-'));

test('instalação antiga e flag configurada não dispensam confirmação HTML', () => {
  const dir = pasta();
  writeFileSync(join(dir, 'perfil.json'), JSON.stringify({ _configurado: true, _formulario_em: '2026-01-01' }));
  assert.equal(concluido(dir), false);
  assert.throws(() => exigirOnboardingHumano(dir), /ONBOARDING_HUMANO_OBRIGATORIO/);
});
test('confirmar sem os sete passos, fora de ordem ou sem confirmação explícita recusa', () => {
  const dir = pasta(); const s = criarSessaoFormulario(dir);
  assert.throws(() => s.confirmar(true), /OBRIGATORIO/);
  assert.throws(() => s.registrarPasso(7), /FORA_DE_ORDEM/);
  for (let i = 1; i <= 6; i++) s.registrarPasso(i);
  assert.throws(() => s.confirmar(true), /OBRIGATORIO/);
  s.registrarPasso(7);
  assert.throws(() => s.confirmar('true'), /OBRIGATORIO/);
  assert.equal(concluido(dir), false);
  s.confirmar(true); assert.equal(concluido(dir), true);
  assert.doesNotThrow(() => exigirOnboardingHumano(dir));
});
test('sessão nova não herda passos vistos da anterior; revisão de passos é permitida', () => {
  const dir = pasta(); const s = criarSessaoFormulario(dir);
  s.registrarPasso(1); s.registrarPasso(2); s.registrarPasso(1);
  assert.throws(() => criarSessaoFormulario(dir).registrarPasso(3), /FORA_DE_ORDEM/);
  assert.equal(concluido(dir), false);
});
test('recibo parcial, corrompido, com passos repetidos ou versão desconhecida não libera', () => {
  const dir = pasta();
  for (const registro of ['{', '{}', JSON.stringify({ versao: 1, origem: 'html-local', confirmadoPelaPessoa: true, concluidoEm: 'agora', passos: [1,2,3,4,5,6,7] }), JSON.stringify({ versao: 2, origem: 'html-local', confirmadoPelaPessoa: true, concluidoEm: new Date().toISOString(), passos: [1,2,3,4,5,6,7] }), JSON.stringify({ versao: 1, origem: 'html-local', confirmadoPelaPessoa: true, concluidoEm: new Date().toISOString(), passos: [1,2,3,4,5,6,6] })]) {
    writeFileSync(join(dir, 'onboarding-humano.json'), registro);
    assert.equal(concluido(dir), false);
  }
});

// Exercita o comando real com atualização simulada; nenhuma rede ou instalação real.
test('entrada bloqueia antes de atualizar e importa configuração somente após atualização', () => {
  const dir = pasta();
  for (const sub of ['vagas/scripts', 'vagas/src', 'vagas/data']) mkdirSync(join(dir, sub), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  for (const arq of ['scripts/executar.mjs', 'src/onboarding-humano.js', 'src/regras-projeto-leitura.js']) {
    writeFileSync(join(dir, 'vagas', arq), readFileSync(new URL('../' + arq, import.meta.url)));
  }
  writeFileSync(join(dir, 'vagas/src/onboarding-autonomia.js'), 'export const lerPolitica = () => ({ atualizarAutomaticamente: true });');
  writeFileSync(join(dir, 'vagas/src/config.js'), "export const perfil = { versao: 1 }; export const DIR_DADOS = " + JSON.stringify(join(dir, 'vagas/data')) + ';');
  writeFileSync(join(dir, 'vagas/src/atualizacao.js'), `import { writeFileSync } from 'node:fs';
    export function podeIniciarOperacao(r) { return r.status === 'atualizado'; }
    export async function atualizarAutomaticamente() {
      writeFileSync(new URL('./config.js', import.meta.url), 'export const perfil = { versao: 2 };');
      writeFileSync(new URL('./onboarding-humano.js', import.meta.url), 'export const VERSAO = 2;');
      return { status: 'atualizado' };
    }`);
  writeFileSync(join(dir, 'vagas/src/coletar.js'), "import { perfil } from './config.js'; import { VERSAO } from './onboarding-humano.js'; console.log('CONFIG_APOS_UPDATE=' + perfil.versao + ';GUARD_APOS_UPDATE=' + VERSAO);");
  const rodar = () => spawnSync(process.execPath, [join(dir, 'vagas/scripts/executar.mjs'), 'rodada'], { encoding: 'utf8', env: { PATH: process.env.PATH || '' } });
  const bloqueado = rodar();
  assert.equal(bloqueado.status, 1);
  assert.match(bloqueado.stderr, /ONBOARDING_HUMANO_OBRIGATORIO/);
  assert.match(readFileSync(join(dir, 'vagas/src/config.js'), 'utf8'), /versao: 1/);
  const s = criarSessaoFormulario(join(dir, 'vagas/data'));
  for (let passo = 1; passo <= 7; passo++) s.registrarPasso(passo);
  s.confirmar(true);
  const pronto = rodar();
  assert.equal(pronto.status, 0, pronto.stderr);
  assert.match(pronto.stdout, /CONFIG_APOS_UPDATE=2;GUARD_APOS_UPDATE=2/);
});
