import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registrarRespostas, migrarHistorico, PONTEIRO_HISTORICO } from '../src/registro-md.js';

const VAGAS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULO = pathToFileURL(path.join(VAGAS, 'src/registro-md.js')).href;

function fixture(t) {
  const raiz = fs.mkdtempSync(path.join(VAGAS, 'test/.registro-md-'));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  return raiz;
}

function entrada(id = 'vaga-1', resposta = 'Texto exato') {
  return {
    contexto: { empresa: 'Empresa Exemplo', vaga: 'Product Designer', id, data: '2026-11-05' },
    campos: [
      { pergunta: 'Conte sua experiência', texto: resposta, preenchida: true },
      { pergunta: 'Pergunta pendente', texto: 'Não informado', preenchida: false },
    ],
  };
}

function conteudo(raiz) { return fs.readFileSync(path.join(raiz, 'aplicacao/RESPOSTAS-PREENCHIDAS.md'), 'utf8'); }

function processo(raiz, pacote) {
  return new Promise((resolve, reject) => {
    const codigo = `import { registrarRespostas } from ${JSON.stringify(MODULO)}; let bruto=''; for await (const parte of process.stdin) bruto+=parte; const resultado=registrarRespostas(JSON.parse(bruto), { raizProjeto: process.argv[1] }); process.stdout.write(JSON.stringify(resultado));`;
    const filho = spawn(process.execPath, ['--input-type=module', '-e', codigo, raiz], { stdio: ['pipe', 'pipe', 'pipe'] });
    let saida = ''; let erro = '';
    filho.stdout.on('data', (dados) => { saida += dados; });
    filho.stderr.on('data', (dados) => { erro += dados; });
    filho.on('error', reject);
    filho.on('close', (codigoSaida) => codigoSaida === 0 ? resolve(JSON.parse(saida)) : reject(new Error(erro)));
    filho.stdin.end(JSON.stringify(pacote));
  });
}

test('registra somente campos preenchidos, mantém texto aberto literal e não duplica pacote', (t) => {
  const raiz = fixture(t);
  const resposta = 'Primeira linha\nSegunda linha com `código` e ~~~\nTerceira linha';
  const pacote = entrada('vaga-1', resposta);
  assert.equal(registrarRespostas(pacote, { raizProjeto: raiz }).registrado, true);
  const primeira = conteudo(raiz);
  assert.ok(primeira.includes(resposta));
  assert.ok(!primeira.includes('Pergunta pendente'));
  assert.ok(!primeira.includes('Não informado'));
  assert.equal(registrarRespostas(pacote, { raizProjeto: raiz }).registrado, false);
  assert.equal(conteudo(raiz), primeira);
  assert.equal(registrarRespostas(entrada('vaga-1', 'Resposta atualizada'), { raizProjeto: raiz }).registrado, true);
  assert.ok(conteudo(raiz).includes(resposta));
  assert.ok(conteudo(raiz).includes('Resposta atualizada'));
});

test('preserva integralmente conteúdo anterior e acrescenta ao fim', (t) => {
  const raiz = fixture(t);
  fs.mkdirSync(path.join(raiz, 'revisoes'));
  const anterior = '# Respostas de formulário\n\nTexto legado sem newline final';
  fs.writeFileSync(path.join(raiz, 'revisoes/respostas.md'), anterior);
  assert.throws(() => registrarRespostas(entrada(), { raizProjeto: raiz }), /HISTORICO_LEGADO_PENDENTE/);
  const migracao = migrarHistorico({ raizProjeto: raiz });
  assert.equal(migracao.bytes, Buffer.byteLength(anterior));
  assert.equal(fs.readFileSync(path.join(raiz, 'revisoes/respostas.md'), 'utf8'), PONTEIRO_HISTORICO);
  assert.equal(conteudo(raiz), anterior);
  registrarRespostas(entrada(), { raizProjeto: raiz });
  assert.ok(conteudo(raiz).startsWith(anterior));
  assert.ok(conteudo(raiz).endsWith('~~~\n'));
});

test('não regrava o arquivo quando nada foi preenchido e conserva bytes legados', (t) => {
  const raiz = fixture(t);
  const vazio = entrada();
  vazio.campos = [{ pergunta: 'Pendente', texto: 'Rascunho', preenchida: false }];
  assert.equal(registrarRespostas(vazio, { raizProjeto: raiz }).registrado, false);
  assert.equal(fs.existsSync(path.join(raiz, 'aplicacao')), false);
  fs.mkdirSync(path.join(raiz, 'revisoes'));
  const arquivo = path.join(raiz, 'revisoes/respostas.md');
  const bytes = Buffer.from([0x23, 0x20, 0x6c, 0x65, 0x67, 0x61, 0x64, 0x6f, 0xff]);
  fs.writeFileSync(arquivo, bytes);
  migrarHistorico({ raizProjeto: raiz });
  assert.ok(fs.readFileSync(path.join(raiz, 'aplicacao/RESPOSTAS-PREENCHIDAS.md')).equals(bytes));
  registrarRespostas(entrada(), { raizProjeto: raiz });
  assert.ok(fs.readFileSync(path.join(raiz, 'aplicacao/RESPOSTAS-PREENCHIDAS.md')).subarray(0, bytes.length).equals(bytes));
});

test('dois processos simultâneos preservam os dois pacotes; duplicata simultânea fica única', async (t) => {
  const raiz = fixture(t);
  const [a, b] = await Promise.all([processo(raiz, entrada('vaga-A', 'Resposta A')), processo(raiz, entrada('vaga-B', 'Resposta B'))]);
  assert.equal(a.registrado, true);
  assert.equal(b.registrado, true);
  assert.equal((conteudo(raiz).match(/^## /gm) || []).length, 2);
  const [c, d] = await Promise.all([processo(raiz, entrada('vaga-C', 'Resposta C')), processo(raiz, entrada('vaga-C', 'Resposta C'))]);
  assert.equal(Number(c.registrado) + Number(d.registrado), 1);
  assert.equal((conteudo(raiz).match(/^## /gm) || []).length, 3);
});

test('rejeita caminho externo, protótipo e alvos com symlink ou hardlink', (t) => {
  const raiz = fixture(t);
  assert.throws(() => registrarRespostas(entrada(), { raizProjeto: path.dirname(VAGAS) + '-fora' }), /CAMINHO_INVALIDO/);
  const poluido = JSON.parse('{"contexto":{"empresa":"X","vaga":"Y","id":"Z","data":"2026-11-05"},"campos":[{"pergunta":"Q","texto":"A","preenchida":true,"__proto__":{}}]}');
  assert.throws(() => registrarRespostas(poluido, { raizProjeto: raiz }), /PACOTE_INVALIDO/);
  const real = path.join(raiz, 'real');
  fs.mkdirSync(real);
  fs.symlinkSync(real, path.join(raiz, 'aplicacao'));
  assert.throws(() => registrarRespostas(entrada(), { raizProjeto: raiz }), /CAMINHO_INSEGURO/);
  fs.unlinkSync(path.join(raiz, 'aplicacao'));
  fs.mkdirSync(path.join(raiz, 'aplicacao'));
  const origem = path.join(raiz, 'origem.md');
  fs.writeFileSync(origem, 'original');
  fs.linkSync(origem, path.join(raiz, 'aplicacao/RESPOSTAS-PREENCHIDAS.md'));
  assert.throws(() => registrarRespostas(entrada(), { raizProjeto: raiz }), /CAMINHO_INSEGURO/);
  assert.equal(fs.readFileSync(origem, 'utf8'), 'original');
});

test('campo sensível só aceita referência e padrões conhecidos de segredo são recusados', (t) => {
  const raiz = fixture(t);
  const pacote = entrada();
  pacote.campos = [{ pergunta: 'CPF', texto: '123.456.789-00', preenchida: true }];
  assert.throws(() => registrarRespostas(pacote, { raizProjeto: raiz }), /DADO_SENSIVEL/);
  pacote.campos = [{ pergunta: 'CPF', referenciaPrivada: 'ref:perfil-pessoal', preenchida: true }];
  registrarRespostas(pacote, { raizProjeto: raiz });
  assert.ok(conteudo(raiz).includes('Referência privada: ref:perfil-pessoal'));
  assert.ok(!conteudo(raiz).includes('123.456.789-00'));
  pacote.campos = [{ pergunta: 'Outro campo', texto: '123.456.789-00', preenchida: true }];
  assert.throws(() => registrarRespostas(pacote, { raizProjeto: raiz }), /DADO_SENSIVEL/);
});

test('perguntas de diversidade e endereço mantêm só referência privada', (t) => {
  const raiz = fixture(t);
  for (const [i, pergunta] of [
    'Do you belong to one of the groups below?',
    'Would you like to apply as a disabled person?',
    'Você pertence a algum dos grupos de diversidade?',
    'Bairro *',
    'Endereço *',
    'CEP *',
    'Street address *',
  ].entries()) {
    const pacote = entrada(`diversidade-${i}`);
    pacote.campos = [{ pergunta, texto: 'Seleção sensível fictícia', preenchida: true }];
    assert.throws(() => registrarRespostas(pacote, { raizProjeto: raiz }), /DADO_SENSIVEL/);
    pacote.campos = [{ pergunta, referenciaPrivada: 'ref:perfil-exemplo.diversidade', preenchida: true }];
    assert.equal(registrarRespostas(pacote, { raizProjeto: raiz }).registrado, true);
  }
  assert.ok(!conteudo(raiz).includes('Seleção sensível fictícia'));
  assert.ok(conteudo(raiz).includes('Referência privada: ref:perfil-exemplo.diversidade'));
});

test('migração é idempotente e recusa duas histórias, inclusive quando iguais', (t) => {
  const raiz = fixture(t);
  fs.mkdirSync(path.join(raiz, 'revisoes'));
  fs.mkdirSync(path.join(raiz, 'aplicacao'));
  const legado = path.join(raiz, 'revisoes/respostas.md');
  const destino = path.join(raiz, 'aplicacao/RESPOSTAS-PREENCHIDAS.md');
  fs.writeFileSync(legado, 'legado');
  fs.writeFileSync(destino, 'legado');
  assert.throws(() => migrarHistorico({ raizProjeto: raiz }), /CONFLITO_HISTORICOS/);
  assert.equal(fs.readFileSync(legado, 'utf8'), 'legado');
  assert.equal(fs.readFileSync(destino, 'utf8'), 'legado');
  fs.unlinkSync(destino);
  assert.equal(migrarHistorico({ raizProjeto: raiz }).migrado, true);
  assert.equal(migrarHistorico({ raizProjeto: raiz }).migrado, false);
  assert.equal(fs.readFileSync(legado, 'utf8'), PONTEIRO_HISTORICO);
  assert.equal(fs.readFileSync(destino, 'utf8'), 'legado');
});

test('migra sobre placeholder novo de zero bytes sem perder histórico legado', (t) => {
  const raiz = fixture(t);
  fs.mkdirSync(path.join(raiz, 'revisoes'));
  fs.mkdirSync(path.join(raiz, 'aplicacao'));
  const legado = path.join(raiz, 'revisoes/respostas.md');
  const destino = path.join(raiz, 'aplicacao/RESPOSTAS-PREENCHIDAS.md');
  const bytes = Buffer.from([0x23, 0x20, 0xff, 0x0a]);
  fs.writeFileSync(legado, bytes);
  fs.writeFileSync(destino, Buffer.alloc(0));
  assert.equal(migrarHistorico({ raizProjeto: raiz }).migrado, true);
  assert.ok(fs.readFileSync(destino).equals(bytes));
  assert.equal(fs.readFileSync(legado, 'utf8'), PONTEIRO_HISTORICO);
});

test('ponteiro antigo adulterado ou sem destino bloqueia gravação', (t) => {
  const raiz = fixture(t);
  fs.mkdirSync(path.join(raiz, 'revisoes'));
  const legado = path.join(raiz, 'revisoes/respostas.md');
  fs.writeFileSync(legado, PONTEIRO_HISTORICO);
  assert.throws(() => registrarRespostas(entrada(), { raizProjeto: raiz }), /CONFLITO_HISTORICOS/);
  fs.writeFileSync(legado, PONTEIRO_HISTORICO + 'outra resposta');
  assert.throws(() => registrarRespostas(entrada(), { raizProjeto: raiz }), /HISTORICO_LEGADO_PENDENTE/);
});

test('recusa symlink e hardlink no histórico legado sem tocar a origem', (t) => {
  const raiz = fixture(t);
  const origem = path.join(raiz, 'original.md');
  fs.writeFileSync(origem, 'original');
  fs.mkdirSync(path.join(raiz, 'revisoes'));
  const legado = path.join(raiz, 'revisoes/respostas.md');
  fs.symlinkSync(origem, legado);
  assert.throws(() => migrarHistorico({ raizProjeto: raiz }), /CAMINHO_INSEGURO/);
  fs.unlinkSync(legado);
  fs.linkSync(origem, legado);
  assert.throws(() => migrarHistorico({ raizProjeto: raiz }), /CAMINHO_INSEGURO/);
  assert.equal(fs.readFileSync(origem, 'utf8'), 'original');
});

test('novos blocos distinguem rascunho de envio com evidência explícita', (t) => {
  const raiz = fixture(t);
  assert.equal(registrarRespostas(entrada(), { raizProjeto: raiz }).registrado, true);
  assert.match(conteudo(raiz), /Estado: rascunho/);
  const enviada = entrada('vaga-enviada');
  enviada.contexto.estado = 'enviada';
  assert.throws(() => registrarRespostas(enviada, { raizProjeto: raiz }), /PACOTE_INVALIDO/);
  enviada.contexto.evidenciaEnvio = 'Confirmação visível na plataforma, protocolo 1234';
  registrarRespostas(enviada, { raizProjeto: raiz });
  assert.match(conteudo(raiz), /Estado: enviada\n\nEvidência de envio: Confirmação visível/);
});
