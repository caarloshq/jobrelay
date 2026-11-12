import test from 'node:test';
import assert from 'node:assert/strict';
import { renderizarFontes, lerFontes, classificarPergunta, atualizarPerfilCampo } from '../src/fontes-respostas.js';

const pergunta = (texto, resposta, extra = {}) => ({
  pergunta: texto, resposta, aprovada: false, escopo: 'uma empresa', fonte: 'exemplo#origem', ...extra,
});
const exemplo = () => ({
  banco: {
    _nota: 'Metadados livres', atualizadoEm: null,
    perguntas: [
      pergunta('What is your email?', null, { id: 'form:1', normalizada: 'what is your email', alternativas: [] }),
      pergunta('Você já conduziu pesquisas?', 'Sim.\nEm dois ciclos.\n```\nTexto.', {
        id: 'form:2', normalizada: 'voce ja conduziu pesquisas', tipo: 'objetiva',
        historico: [{ resposta: 'Texto anterior', aprovada: false }],
      }),
      pergunta('Conte um caso.', '', { contexto: { prazo: 2, nota: null } }),
    ],
  },
  perfil: {
    identidade: { nome: 'Pessoa Exemplo', email: null, ativo: false },
    escolhas: { idiomas: ['Português', '日本語'], notas: [{ texto: 'a\nb', valor: 0 }] },
    vazio: {}, outroVazio: [],
  },
});

test('round-trip conserva banco e perfil completos, null, vazio, Unicode e cercas dentro de texto', () => {
  const origem = exemplo();
  const fontes = renderizarFontes(origem);
  assert.match(fontes.respostas, /Sim\.\nEm dois ciclos\.\n```\nTexto\./);
  assert.match(fontes.perfil, /Pessoa Exemplo/);
  assert.deepEqual(lerFontes(fontes), origem);
});

test('classificação positiva mantém Sim/Não profissional nas respostas', () => {
  assert.equal(classificarPergunta(pergunta('Você já conduziu pesquisas?', 'Sim', { tipo: 'objetiva' })), 'respostas');
  assert.equal(classificarPergunta(pergunta('Qual seu telefone?', null)), 'perfil');
  assert.equal(classificarPergunta(pergunta('Were you referred by someone?', 'No')), 'perfil');
  for (const rotulo of ['Salary as employee', 'Full name', 'Email', 'Expected salary', 'Current location']) {
    assert.equal(classificarPergunta(pergunta(rotulo, null)), 'perfil', rotulo);
  }
  assert.equal(classificarPergunta(pergunta('How many years of experience do you have?', '7')), 'respostas');
});

test('texto editorial suplementar fica fora dos dados e campo exato pode ser atualizado', () => {
  const fontes = renderizarFontes(exemplo());
  const trecho = '\n## Pendências\n\nAguardar decisão com escopo explícito.\n';
  const comNotas = fontes.perfil + trecho;
  const alterado = atualizarPerfilCampo(comNotas, ['identidade', 'email'], 'alguem@example.test');
  assert.ok(alterado.endsWith(trecho));
  assert.equal(lerFontes({ ...fontes, perfil: alterado }).perfil.identidade.email, 'alguem@example.test');
  assert.equal(lerFontes({ ...fontes, perfil: alterado }).perfil.identidade.nome, 'Pessoa Exemplo');
});

test('fonte inválida falha sem recorrer a projeção antiga', () => {
  const fontes = renderizarFontes(exemplo());
  assert.throws(() => lerFontes({ ...fontes, respostas: fontes.respostas.replace('jobrelay-banco', 'jobrelay-invalido') }), /metadados do banco ausentes/);
  assert.throws(() => lerFontes({ ...fontes, respostas: fontes.respostas.replace('```jobrelay-resposta', '```jobrelay-outro') }), /incompleta|bloco inesperado/);
  assert.throws(() => lerFontes({ ...fontes, perfil: fontes.perfil.replace('jobrelay-fontes-v1:perfil', 'jobrelay-fontes-v0:perfil') }), /marcador/);
});

test('ordem faltante, ordem duplicada e ID duplicado falham explicitamente', () => {
  const origem = exemplo();
  const fontes = renderizarFontes(origem);
  const faltando = fontes.respostas.replace('"ordem": 1', '"ordem": 4');
  assert.throws(() => lerFontes({ ...fontes, respostas: faltando }), /sequência incompleta/);
  const duplicada = fontes.respostas.replace('"ordem": 2', '"ordem": 1');
  assert.throws(() => lerFontes({ ...fontes, respostas: duplicada }), /ordem duplicada/);
  origem.banco.perguntas[1].id = 'form:1';
  assert.throws(() => renderizarFontes(origem), /ID duplicado/);
});

test('manifestos rejeitam truncamento de registro completo e campo completo', () => {
  const fontes = renderizarFontes(exemplo());
  const respostas = fontes.respostas.slice(0, fontes.respostas.lastIndexOf('### Pergunta 3'));
  assert.throws(() => lerFontes({ ...fontes, respostas }), /quantidade de perguntas divergente/);
  const perfil = fontes.perfil.slice(0, fontes.perfil.lastIndexOf('### outroVazio'));
  assert.throws(() => lerFontes({ ...fontes, perfil }), /quantidade de campos do perfil divergente/);
});

test('pendências vêm primeiro em ambas as fontes sem alterar ordem do banco', () => {
  const origem = exemplo();
  origem.banco.perguntas.unshift(pergunta('Conte uma entrega.', 'Entrega verificada.', { id: 'form:0', aprovada: true }));
  origem.banco.perguntas.push(pergunta('Current location', 'Cidade exemplo', { id: 'form:3', aprovada: true }));
  const fontes = renderizarFontes(origem);
  for (const md of [fontes.respostas, fontes.perfil]) {
    assert.ok(md.indexOf('## Respostas pendentes') < md.indexOf('## Respostas disponíveis'));
  }
  assert.ok(fontes.respostas.indexOf('### Pergunta 3 · aguarda aprovação') < fontes.respostas.indexOf('### Pergunta 1:'));
  assert.ok(fontes.perfil.indexOf('### Pergunta 2 · sem resposta') < fontes.perfil.indexOf('### Pergunta 5:'));
  assert.ok(fontes.perfil.indexOf('### Campos do perfil sem resposta') < fontes.perfil.indexOf('## Respostas disponíveis'));
  assert.deepEqual(lerFontes(fontes), origem);
});

test('Arsenal de entrevista fecha RESPOSTAS.md e texto livre nele não altera o banco', () => {
  const origem = exemplo();
  const fontes = renderizarFontes(origem);
  assert.ok(fontes.respostas.indexOf('## Respostas disponíveis') < fontes.respostas.indexOf('# Arsenal de entrevista'));
  assert.ok(!fontes.perfil.includes('# Arsenal de entrevista'));
  const editado = fontes.respostas + '\n## 1. Fale sobre você\n\n> Resposta em fala, escrita a partir das palavras da pessoa.\n';
  assert.deepEqual(lerFontes({ ...fontes, respostas: editado }), origem);
  const anterior = renderizarFontes(origem, { arsenal: false });
  assert.ok(!anterior.respostas.includes('# Arsenal de entrevista'));
  assert.equal(anterior.perfil, fontes.perfil);
  assert.deepEqual(lerFontes(anterior), origem);
});

test('JSON embutido recusa chave repetida inclusive em metadados aninhados', () => {
  const fontes = renderizarFontes(exemplo());
  const respostas = fontes.respostas.replace('"fonte": "exemplo#origem",', '"fonte": "exemplo#origem",\n    "fonte": "fonte-falsa",');
  assert.throws(() => lerFontes({ ...fontes, respostas }), /chave duplicada/);
  const aninhado = fontes.respostas.replace('"prazo": 2,', '"prazo": 2,\n        "prazo": 3,');
  assert.throws(() => lerFontes({ ...fontes, respostas: aninhado }), /chave duplicada/);
});

test('atualização rejeita caminho ausente e preserva null até escolha explícita', () => {
  const fontes = renderizarFontes(exemplo());
  assert.equal(lerFontes(fontes).perfil.identidade.email, null);
  assert.throws(() => atualizarPerfilCampo(fontes.perfil, ['identidade', 'inexistente'], 'x'), /campo ausente/);
  assert.throws(() => atualizarPerfilCampo(fontes.perfil, ['identidade'], 'x'), /estrutura/);
});
