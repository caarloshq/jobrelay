import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { operar } from '../src/operacao.js';
import { hashPacoteRespostas } from '../src/revisao-respostas.js';

function fixture(t) {
  const root = fileURLToPath(new URL('../data/testes-revisor/', import.meta.url));
  fs.mkdirSync(root, { recursive: true });
  const dados = fs.mkdtempSync(path.join(root, 'caso-'));
  t.after(() => fs.rmSync(dados, { recursive: true, force: true }));
  const { token } = operar(dados, 'iniciar', { dono: 'maestro', bootstrapNovo: true });
  const identidade = { canonico: 'fixture:editor' };
  const { reserva } = operar(dados, 'reservar', { token, identidade, etapa: 'preparar', dono: 'autor' });
  const mapa = Object.fromEntries(['anuncio','base','regras','respostas','perfil','voz','escrita'].map(p => {
    const caminho = path.join(dados, `${p}.md`); fs.writeFileSync(caminho, `Fonte fictícia de ${p}.`); return [p, caminho];
  }));
  const { fontesEsperadas: fontesLocais } = operar(dados, 'fixar_fontes', { token, identidade, fontesEsperadas: mapa });
  const pacoteRespostas = { contexto: { empresa: 'Empresa Fictícia', vaga: 'Designer' }, fontes: structuredClone(fontesLocais).filter(f => ['respostas','perfil','voz','escrita'].includes(f.papel)),
    campos: [{ pergunta: 'Como você prioriza?', texto: 'Comparo esforço e impacto com o time.', fonte: `${mapa.respostas}#prioridade`, escopo: 'geral' }] };
  const args = { token, taskId: reserva.taskId, revisao: 1, autor: 'autor', tipo: 'candidatura', versoes: { anuncio: 'v1' }, fontesLocais, pacoteRespostas };
  const parecer = p => ({ revisor: 'editor', decisao: 'aprovado', hashPacote: hashPacoteRespostas(p), achados: [],
    criterios: Object.fromEntries(['pergunta','clareza','fatos','voz','escopo'].map(c => [c, { ok: true, evidencia: `O trecho “Comparo esforço e impacto” atende ao eixo ${c} e à fonte sintética.` }])) });
  return { dados, token, identidade, args, mapa, parecer };
}
const preflight = Object.fromEntries(['origemStatus','statusAtual','statusRef','anuncioRef','autorizacaoRef','formularioRef','validacaoRef'].map(k => [k, `fixture:${k}`]));

test('plano despacha editor; revisão genérica não libera candidatura; fonte alterada invalida intenção', t => {
  const f = fixture(t), { entrega } = operar(f.dados, 'entregar', f.args);
  const plano = operar(f.dados, 'planejar');
  assert.equal(plano.papeis.revisaoEscrita.length, 1);
  assert.equal(plano.papeis.revisao.length, 0);
  const revisar = { token: f.token, entregaId: entrega.entregaId, hash: entrega.hash, revisor: 'editor', parecer: 'aprovado' };
  assert.throws(() => operar(f.dados, 'revisar', revisar), /REVISAO_ESCRITA_INVALIDA/);
  assert.throws(() => operar(f.dados, 'pronta', revisar), /REVISAO_INVALIDA/);
  operar(f.dados, 'revisar', { ...revisar, revisaoEscrita: f.parecer(f.args.pacoteRespostas) });
  operar(f.dados, 'pronta', revisar);
  assert.equal(operar(f.dados, 'planejar').papeis.aplicador[0].liberadoUI, false);
  fs.appendFileSync(f.mapa.escrita, ' Nova regra.');
  assert.equal(operar(f.dados, 'planejar').papeis.aplicador.length, 0);
  assert.throws(() => operar(f.dados, 'intencao', { token: f.token, identidade: f.identidade, versoes: f.args.versoes, preflight }), /FONTE_MUDOU/);
});

test('editorial aprovado permite somente intenção simulada, sem liberar clique', t => {
  const f = fixture(t), { entrega } = operar(f.dados, 'entregar', f.args);
  operar(f.dados, 'revisar', { token: f.token, entregaId: entrega.entregaId, hash: entrega.hash, revisor: 'editor', parecer: 'aprovado', revisaoEscrita: f.parecer(f.args.pacoteRespostas) });
  operar(f.dados, 'pronta', { token: f.token, entregaId: entrega.entregaId });
  const r = operar(f.dados, 'intencao', { token: f.token, identidade: f.identidade, versoes: f.args.versoes, preflight });
  assert.equal(r.liberadoClique, false);
});

test('pacote de candidatura antigo sem respostas e fonte editorial não fixada falham fechados', t => {
  for (const caso of ['antigo', 'fonte']) {
    const f = fixture(t);
    if (caso === 'antigo') delete f.args.pacoteRespostas;
    else f.args.pacoteRespostas.fontes[0].hash = 'b'.repeat(64);
    const { entrega } = operar(f.dados, 'entregar', f.args);
    assert.throws(() => operar(f.dados, 'revisar', { token: f.token, entregaId: entrega.entregaId, hash: entrega.hash, revisor: 'editor', parecer: 'aprovado', revisaoEscrita: f.parecer(f.args.pacoteRespostas) }), /REVISAO_ESCRITA_OBRIGATORIA|FONTE_EDITORIAL_NAO_FIXADA/);
  }
});
