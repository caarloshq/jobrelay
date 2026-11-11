import test from 'node:test';
import assert from 'node:assert/strict';
import { planejarConsultasLinkedin } from '../src/linkedin-consultas.js';

for (const titulo of ['Engenheiro de Dados', 'Enfermagem', 'Analista Financeiro']) {
  test(`consultas usam o cargo da instalação: ${titulo}`, () => {
    const p = planejarConsultasLinkedin({ _configurado: true, cargo_alvo: titulo, profissao: titulo }, { consultas_estreitas: ['Product Designer'] });
    assert.equal(p.estado, 'pronto'); assert.equal(p.beta, true); assert.equal(p.consultas.length, 1);
    const [q] = p.consultas;
    assert.equal(new URL(q.jobsUrl).searchParams.get('keywords'), titulo);
    assert.equal(new URL(q.postagensUrl).searchParams.get('keywords'), `${titulo} vagas`);
    assert.doesNotMatch(JSON.stringify(p), /Product Designer/);
    assert.equal(p.feed.filtravelPorTermo, false);
  });
}

test('profissão e termos confirmados ampliam títulos com dedup e limite', () => {
  const p = planejarConsultasLinkedin({ _configurado: true, cargo_alvo: ' Engenheiro de Dados ', profissao: 'Engenharia de Dados', profissao_confirmada: true }, { consultas_estreitas: ['engenheiro de dados', 'Data Engineer'], titulo_aceito: { 'Data Engineer': 20, 'Analytics Engineer': 10 } });
  assert.deepEqual(p.consultas.map(c => c.titulo), ['Engenheiro de Dados', 'Engenharia de Dados', 'Data Engineer', 'Analytics Engineer']);
  assert.equal(planejarConsultasLinkedin({ _configurado: true, cargo_alvo: 'Cargo', profissao_confirmada: true }, { consultas_estreitas: Array.from({ length: 20 }, (_, i) => `Título ${i}`) }).consultas.length, 8);
});

test('encoding preserva acentos e símbolos sem injetar novos parâmetros', () => {
  const titulo = 'Técnico em Enfermagem & Saúde / UTI?';
  const q = planejarConsultasLinkedin({ _configurado: true, profissao: titulo }).consultas[0];
  for (const url of [q.jobsUrl, q.postagensUrl]) { const u = new URL(url); assert.equal(u.hostname, 'www.linkedin.com'); assert.deepEqual([...u.searchParams.keys()], ['keywords']); }
  assert.equal(new URL(q.jobsUrl).searchParams.get('keywords'), titulo);
});

test('onboarding incompleto e cargo vazio não herdam consultas dos exemplos', () => {
  for (const perfil of [{}, { _configurado: false, cargo_alvo: 'Engenheiro de Dados' }, { _configurado: true }]) {
    const p = planejarConsultasLinkedin(perfil, { consultas_estreitas: ['Product Designer'] });
    assert.equal(p.estado, 'perfil_pendente'); assert.deepEqual(p.consultas, []);
  }
});

import { conferirConsultaLinkedin } from '../src/linkedin-consultas.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('consulta exige URL planejada e termo observado na interface; feed não filtra', () => {
  const p = planejarConsultasLinkedin({ _configurado: true, cargo_alvo: 'Enfermagem' });
  for (const rota of ['jobs', 'postagens']) {
    const c = { rota, titulo: 'Enfermagem', bloqueada: false, urlObservada: rota === 'jobs' ? p.consultas[0].jobsUrl : p.consultas[0].postagensUrl, termoObservado: rota === 'jobs' ? 'Enfermagem' : 'Enfermagem vagas' };
    assert.equal(conferirConsultaLinkedin(p, c).estado, 'confirmada');
    for (const delta of [{ termoObservado: '' }, { termoObservado: 'Product Designer' }, { bloqueada: true }, { bloqueada: undefined }, { urlObservada: 'https://evil.test/jobs/search/?keywords=Enfermagem' }, { urlObservada: 'https://www.linkedin.com/login?keywords=Enfermagem' }, { urlObservada: `${c.urlObservada}&keywords=outra` }]) assert.notEqual(conferirConsultaLinkedin(p, { ...c, ...delta }).estado, 'confirmada');
  }
  assert.equal(conferirConsultaLinkedin(p, { rota: 'feed' }).estado, 'nao_filtravel');
  assert.equal(conferirConsultaLinkedin(p, { rota: 'feed', bloqueada: true }).estado, 'bloqueada');
});

test('CLI recusa perfil pendente e consulta incerta sem contar tempo; atestado válido conserva referência UI', t => {
  const vagas = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const base = path.join(vagas, 'data/testes-consultas-cli'); fs.mkdirSync(base, { recursive: true });
  const raiz = fs.mkdtempSync(path.join(base, 'caso-')); t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  fs.cpSync(path.join(vagas, 'src'), path.join(raiz, 'src'), { recursive: true });
  fs.cpSync(path.join(vagas, 'config'), path.join(raiz, 'config'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'scripts')); fs.mkdirSync(path.join(raiz, 'data'));
  fs.copyFileSync(path.join(vagas, 'scripts/linkedin-feed.mjs'), path.join(raiz, 'scripts/linkedin-feed.mjs'));
  fs.writeFileSync(path.join(raiz, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(raiz, 'src/onboarding-humano.js'), 'export const exigirOnboardingHumano = () => {}; // somente fixture offline');
  fs.writeFileSync(path.join(raiz, 'config/linkedin-feed.json'), '{"habilitado":true}');
  const perfilPath = path.join(raiz, 'config/perfil.json'); const perfil = JSON.parse(fs.readFileSync(perfilPath));
  const run = (acao, dados) => { const arq = path.join(raiz, 'entrada.json'); fs.writeFileSync(arq, JSON.stringify(dados)); return spawnSync(process.execPath, [path.join(raiz, 'scripts/linkedin-feed.mjs'), acao, '--dono', 'fixture', '--arquivo', arq], { encoding: 'utf8', env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR } }); };
  perfil._configurado = false; fs.writeFileSync(perfilPath, JSON.stringify(perfil));
  assert.match(run('iniciar', { browserLiberadoRef: 'fixture:navegador' }).stderr, /PERFIL_CONSULTA_PENDENTE/);
  perfil._configurado = true; perfil.cargo_alvo = 'Enfermagem'; perfil.profissao_confirmada = false; fs.writeFileSync(perfilPath, JSON.stringify(perfil));
  const inicio = run('iniciar', { browserLiberadoRef: 'fixture:navegador' }); assert.equal(inicio.status, 0, inicio.stderr);
  const sessao = JSON.parse(inicio.stdout);
  const intervalo = { rota: 'jobs', inicioEm: sessao.iniciadaEm, fimEm: new Date().toISOString(), evidenciaInicio: 'fixture:inicio', evidenciaFim: 'fixture:fim', provaRef: 'fixture:atividade' };
  assert.match(run('intervalo', intervalo).stderr, /CONSULTA_UI_OBRIGATORIA/);
  const consulta = { titulo: 'Enfermagem', urlObservada: 'https://www.linkedin.com/jobs/search/?keywords=Enfermagem', termoObservado: 'outra', bloqueada: false, provaRef: 'fixture:UI-observada' };
  assert.match(run('intervalo', { ...intervalo, consulta }).stderr, /CONSULTA_NAO_CONFIRMADA/);
  consulta.termoObservado = 'Enfermagem'; consulta.bloqueada = true;
  assert.match(run('intervalo', { ...intervalo, consulta }).stderr, /CONSULTA_NAO_CONFIRMADA/);
  consulta.bloqueada = false;
  assert.match(run('intervalo', { ...intervalo, consulta: { ...consulta, provaRef: '' } }).stderr, /CONSULTA_UI_OBRIGATORIA/);
  assert.match(run('intervalo', { ...intervalo, provaRef: undefined, consulta }).stderr, /PROVA_INTERVALO_OBRIGATORIA/);
  assert.match(run('intervalo', { ...intervalo, provaRef: ' ', consulta }).stderr, /PROVA_INTERVALO_OBRIGATORIA/);
  const ok = run('intervalo', { ...intervalo, consulta }); assert.equal(ok.status, 0, ok.stderr);
  const atualizado = JSON.parse(ok.stdout);
  assert.equal(atualizado.intervalos.length, 1); assert.match(atualizado.intervalos[0].provaRef, /consulta-interface:fixture:UI-observada/);
  assert.equal(atualizado.consultaConferida.fonteObservacao, 'termo_conferido_na_interface');
});
