import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { instrucaoOnboarding, lerPolitica, normalizarEscolhas, salvarPolitica } from '../src/onboarding-autonomia.js';

const vagas = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(vagas, 'data/testes-onboarding-autonomia');
fs.mkdirSync(base, { recursive: true });

test('padrão desliga autonomia e candidatura, com intervalo e cota fixos', t => {
  const dados = fs.mkdtempSync(path.join(base, 'fixture-'));
  t.after(() => fs.rmSync(dados, { recursive: true, force: true }));
  assert.deepEqual(lerPolitica(dados), { ativa: false, atualizarAutomaticamente: true, frentes: ['coleta', 'aplicacao'], intervaloHoras: 4, apifyMaximoPorDia: 1, modoCandidatura: 'mapear' });
  const escolhas = normalizarEscolhas({ fonteEstado: 'local', modoCandidatura: 'mapear', autonomia: false });
  salvarPolitica(dados, escolhas.politica);
  assert.deepEqual(lerPolitica(dados), escolhas.politica);
});

test('Chrome e Notion geram instrução de confirmação sem autorizar envio', () => {
  const escolhas = normalizarEscolhas({ fonteEstado: 'notion', databaseId: '123456781234123412341234567890ab', modoCandidatura: 'chrome_assistido', autonomia: true });
  const prompt = instrucaoOnboarding({ ...escolhas, politica: escolhas.politica });
  assert.match(prompt, /agendador nativo.*4 horas/);
  assert.match(prompt, /no máximo uma execução da Apify por dia/);
  assert.match(prompt, /não autoriza preenchimento ou envio irrestrito/);
  assert.match(prompt, /database ID 123456781234123412341234567890ab/);
  assert.match(prompt, /respostas só nos Markdown locais.*Markdown local \+ minha página Notion/);
  assert.doesNotMatch(prompt, /token\s*=/i);
});

test('rejeita fonte, database e modos inválidos', () => {
  assert.throws(() => normalizarEscolhas({ fonteEstado: 'notion', databaseId: 'token-secreto', modoCandidatura: 'mapear', autonomia: false }), /ID de 32 caracteres/);
  assert.throws(() => normalizarEscolhas({ fonteEstado: 'local', modoCandidatura: 'livre', autonomia: true }), /mapear/);
  assert.throws(() => normalizarEscolhas({ fonteEstado: 'local', modoCandidatura: 'mapear', autonomia: 'sim' }), /rodada automática/);
});

test('script embutido do formulário tem sintaxe válida', () => {
  const html = fs.readFileSync(path.join(vagas, '../onboarding/index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new vm.Script(script));
});


test('Notion sem ID fica para criação assistida e atualização pode ser desligada', () => {
  const escolha = normalizarEscolhas({ fonteEstado: 'notion', modoCandidatura: 'mapear', autonomia: false, atualizarAutomaticamente: false });
  assert.equal(escolha.databaseId, '');
  assert.equal(escolha.politica.atualizarAutomaticamente, false);
  const prompt = instrucaoOnboarding(escolha);
  assert.match(prompt, /criar um quadro no Notion/);
  assert.match(prompt, /página Puxa Vagas/);
  assert.match(prompt, /bundle local não depende de acesso ao Notion dele/);
  assert.match(prompt, /19 campos, quatro grupos, cinco visualizações/);
  assert.match(prompt, /ajustes manuais/);
  assert.match(prompt, /excluindo o exemplo do ciclo operacional/);
  assert.match(prompt, /Não consulte nem instale releases automaticamente/);
  assert.doesNotMatch(prompt, /database ID undefined/);
});


test('frentes e captura são preferências separadas, sem autorizar envio', () => {
  for (const frentes of [['coleta'], ['aplicacao'], ['coleta','aplicacao']]) {
    for (const feed of [false,true]) {
      const entrada={fonteEstado:'local',modoCandidatura:'mapear',autonomia:false,frentes,linkedinFeed:feed};
      if(feed && !frentes.includes('coleta')) {assert.throws(()=>normalizarEscolhas(entrada), /exige a frente/);continue;}
      const escolha=normalizarEscolhas(entrada);assert.deepEqual(escolha.politica.frentes,frentes);assert.equal(escolha.linkedinFeed,feed);
      assert.match(instrucaoOnboarding(escolha),/não autoriza envio irrestrito/);
      assert.match(instrucaoOnboarding(escolha),/confirmação da versão antes de baixar/);
    }
  }
});
