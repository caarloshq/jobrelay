import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPacoteRespostas, validarRevisaoRespostas } from '../src/revisao-respostas.js';

function fixture() {
  const pacote = { contexto: { empresa: 'Empresa Sintética', vaga: 'Designer', idioma: 'pt-BR' },
    campos: [{ pergunta: 'Como você decide uma prioridade?', texto: 'Comparo o impacto esperado com o esforço e confirmo a decisão com o time.', fonte: 'respostas.md#prioridades', escopo: 'geral' }],
    fontes: ['respostas', 'perfil', 'voz', 'escrita'].map(papel => ({ papel, caminho: `${papel}.md`, hash: 'a'.repeat(64) })) };
  const parecer = { revisor: 'revisor-editorial', hashPacote: hashPacoteRespostas(pacote), decisao: 'aprovado',
    criterios: Object.fromEntries(['pergunta', 'clareza', 'fatos', 'voz', 'escopo'].map(c => [c, { ok: true, evidencia: `Critério ${c}: “Comparo o impacto esperado” descreve o processo solicitado em respostas.md#prioridades.` }])), achados: [] };
  return { pacote, parecer };
}
const validar = (pacote, parecer, autor = 'preparador') => validarRevisaoRespostas(pacote, parecer, { autor });

test('parecer independente com evidências específicas aprova pacote sintético', () => {
  const { pacote, parecer } = fixture();
  assert.deepEqual(validar(pacote, parecer), { ok: true, erros: [] });
  assert.equal(hashPacoteRespostas({ b: 2, a: 1 }), hashPacoteRespostas({ a: 1, b: 2 }));
});
test('qualquer alteração de resposta, pergunta, contexto ou fonte invalida parecer anterior', () => {
  for (const alterar of [p => { p.campos[0].texto += ' Alteração.'; }, p => { p.campos[0].pergunta += '?'; }, p => { p.contexto.empresa = 'Outra'; }, p => { p.fontes[0].hash = 'b'.repeat(64); }, p => { p.campos[0].limite = 200; }]) {
    const { pacote, parecer } = fixture(); alterar(pacote);
    assert.ok(validar(pacote, parecer).erros.includes('HASH_REVISAO_RESPOSTAS_DIVERGENTE'));
  }
});
test('autor não revisa o próprio texto; ausência de autoria, parecer ou critérios bloqueia', () => {
  const { pacote, parecer } = fixture();
  assert.equal(validar(pacote, parecer, ' REVISOR-EDITORIAL ').ok, false);
  assert.equal(validar(pacote, parecer, '').ok, false);
  assert.equal(validar(pacote, null).ok, false);
  delete parecer.criterios.voz;
  assert.ok(validar(pacote, parecer).erros.includes('CRITERIO_EDITORIAL_INCOMPLETO:voz'));
});
test('flags e evidências genéricas não substituem leitura editorial; reprovação e achados bloqueiam', () => {
  for (const alterar of [r => { r.criterios.clareza = { ok: true, evidencia: 'Revisado e aprovado sem problemas.' }; }, r => { r.decisao = 'reprovado'; }, r => { r.achados = ['A resposta não atende à pergunta.']; }, r => { r.criterios.fatos.ok = false; }]) {
    const { pacote, parecer } = fixture(); alterar(parecer);
    assert.equal(validar(pacote, parecer).ok, false);
  }
});
test('fontes obrigatórias e vínculo por campo são conferidos', () => {
  for (const alterar of [p => { p.fontes.pop(); }, p => { p.fontes[0].hash = 'invalido'; }, p => { p.campos[0].fonte = 'inventada.md'; }]) {
    const { pacote, parecer } = fixture(); alterar(pacote); parecer.hashPacote = hashPacoteRespostas(pacote);
    assert.equal(validar(pacote, parecer).ok, false);
  }
});
test('limites e alternativas literais preservam o que o formulário aceita', () => {
  const { pacote, parecer } = fixture();
  Object.assign(pacote.campos[0], { texto: 'Sim', tipo: 'literal', alternativas: ['Sim', 'Não'], limite: 3 });
  parecer.hashPacote = hashPacoteRespostas(pacote);
  parecer.criterios.pergunta.evidencia += ` [campo:0] Escolha literal mantida: ${pacote.campos[0].pergunta}`;
  assert.equal(validar(pacote, parecer).ok, true);
  pacote.campos[0].texto = 'Talvez'; parecer.hashPacote = hashPacoteRespostas(pacote);
  assert.ok(validar(pacote, parecer).erros.includes('ALTERNATIVA_LITERAL_INVALIDA:0'));
  assert.ok(validar(pacote, parecer).erros.includes('LIMITE_RESPOSTA_INVALIDO:0'));
});
test('metatexto e vetos configurados bloqueiam texto final sem censurar a pergunta', () => {
  for (const texto of ['TODO: preencher', 'Tenho experiência em competência vedada.']) {
    const { pacote, parecer } = fixture(); pacote.vetos = ['competência vedada']; pacote.campos[0].texto = texto; parecer.hashPacote = hashPacoteRespostas(pacote);
    assert.equal(validar(pacote, parecer).ok, false);
  }
  const { pacote, parecer } = fixture(); pacote.vetos = ['competência vedada']; pacote.campos[0].pergunta = 'Você possui competência vedada?'; parecer.hashPacote = hashPacoteRespostas(pacote);
  assert.equal(validar(pacote, parecer).ok, true);
});
test('formulário sem respostas dispensa parecer, mantendo contexto e fontes válidos', () => {
  const { pacote } = fixture(); pacote.campos = [];
  assert.equal(validar(pacote, null).ok, true);
  delete pacote.contexto;
  assert.equal(validar(pacote, null).ok, false);
});

test('parecer do lote precisa cobrir todos os campos, não apenas o primeiro', () => {
  const { pacote, parecer } = fixture();
  pacote.campos.push({ ...pacote.campos[0], pergunta: 'Como você negocia um prazo?', texto: 'Defino o recorte com a equipe e documento a data combinada.' });
  parecer.hashPacote = hashPacoteRespostas(pacote);
  assert.ok(validar(pacote, parecer).erros.includes('CAMPO_SEM_EVIDENCIA_EDITORIAL:1'));
  parecer.criterios.pergunta.evidencia += ' No campo “Como você negocia um prazo?” há ação e data combinada.';
  assert.equal(validar(pacote, parecer).ok, true);
});
