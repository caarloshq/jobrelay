import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerEstado, salvarEstado } from '../src/estado-central.js';
import { gravarTentativaFicha, lerFichas, localizarFicha, usaFichas } from '../src/fichas-vagas.js';
import { migrarFichas } from '../src/migracao-fichas.js';
import { atualizarPendencia, registrarPendencias, lerPendencias } from '../src/pendencias-candidaturas.js';
import { registrarRespostas } from '../src/registro-md.js';
import { operar } from '../src/operacao.js';
import { operarLote } from '../src/rodada-lote.js';
import { gravarJsonAtomico } from '../src/persistencia.js';

const projeto = fileURLToPath(new URL('../..', import.meta.url));
const id = 'portal:101';
const outro = 'portal:102';
const rede = 'linkedin:235';
const arquivo = (...partes) => path.join(...partes);
const fichaQuadro = (status, titulo) => ({ status, titulo, empresa: 'Empresa Exemplo', historico: [] });
const json = (destino, valor) => gravarJsonAtomico(destino, valor);
const pendencia = { id: 'p-101', idCanonico: rede, empresa: 'Empresa Exemplo', cargo: 'Designer',
  tipo: 'video', etapa: 'triagem', urlCheckpoint: 'https://example.invalid/101', exigencia: 'Gravar vídeo',
  proximaAcao: 'Gravar e anexar o vídeo', fonte: 'formulario:fixture', data: '2026-01-01' };

function fixture(t) {
  const raiz = fs.mkdtempSync(path.join(projeto, '.teste-fichas-'));
  const dir = arquivo(raiz, 'local/data');
  const aplicacao = arquivo(raiz, 'local/aplicacao');
  const quadro = arquivo(dir, 'quadro.json');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(aplicacao, { recursive: true });
  fs.mkdirSync(arquivo(raiz, 'core'));
  json(arquivo(raiz, 'core/package.json'), {});
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  return { raiz, dir, aplicacao, quadro };
}

test('migra uma instalação 1.6, filtra valores protegidos e mantém a mesma ficha nas entradas usuais', t => {
  const f = fixture(t);
  const antes = { versao: 2, vagas: {
    [id]: { ...fichaQuadro('Aplicar', 'Designer'), idsAlternativos: [rede],
      formulario: [{ type: 'password', label: 'Digite aqui', value: 'nao-registrar-a1' },
        { nome: 'RG', label: 'Digite aqui', resposta: 'nao-registrar-a2' },
        { tipo: 'text', type: 'password', value: 'nao-registrar-a5' }] },
    [outro]: fichaQuadro('Já apliquei', 'Researcher'),
  } };
  json(f.quadro, antes);
  json(arquivo(f.dir, 'historico.json'), { vagas: { [id]: { dias: ['2026-01-01'] }, [rede]: { dias: ['2026-01-02'] } } });
  const { token } = operar(f.dir, 'iniciar', { dono: 'fixture' });
  operar(f.dir, 'encerrar', { token });
  json(arquivo(f.dir, 'tentativas-envio.json'), { contrato: 1, tentativas: {
    't-1': { chave: id, tentativaId: 't-1', desfecho: 'confirmado', provaRef: 'prova:recibo-101' },
  } });
  registrarPendencias(f.dir, [pendencia]);
  fs.writeFileSync(arquivo(f.aplicacao, 'RESPOSTAS-PREENCHIDAS.md'), [
    '## Empresa Exemplo | Designer | linkedin:235 | 2026\\-01\\-01',
    'Estado: rascunho', '', '### RG', '', '~~~text', 'nao-registrar-a3', '~~~',
    '', '### Date of birth', '', '~~~text', 'nao-registrar-a4', '~~~',
    '', '### Disponibilidade', '', '~~~text', 'Imediata', '~~~', '',
    '## Registro anterior sem vínculo', '',
  ].join('\n'));
  const previa = migrarFichas(f.dir, 'prever');
  assert.equal(previa.fichas, 2);
  assert.equal(previa.contagem.respostasSemVinculo, 1);
  assert.equal(usaFichas(f.dir), false);
  const resultado = migrarFichas(f.dir);
  assert.equal(resultado.estado, 'ativada');
  assert.equal(migrarFichas(f.dir).estado, 'ja_ativa');
  const ficha = localizarFicha(f.dir, rede);
  assert.equal(ficha.ficha.id, id);
  assert.ok(ficha.arquivo.endsWith('/pendentes/0001.md'));
  const md = fs.readFileSync(ficha.arquivo, 'utf8');
  assert.match(md, /Disponibilidade.*Imediata/);
  assert.match(md, /prova:recibo/);
  assert.doesNotMatch(md, /nao-registrar/);
  assert.doesNotMatch(fs.readFileSync(f.quadro, 'utf8'), /nao-registrar/);
  assert.deepEqual(JSON.parse(fs.readFileSync(arquivo(resultado.backup, 'quadro.json'))), antes);
  assert.equal(ficha.ficha.aparicoesPorId[rede].dias[0], '2026-01-02');
  assert.equal(localizarFicha(f.dir, outro).ficha.tentativas.length, 0);

  assert.throws(() => atualizarPendencia(f.dir, pendencia.id, 'resolvida', `${rede}|triagem|Bearer ficticio`), /PROVA_VAGA_ETAPA_OBRIGATORIA/);
  assert.equal(lerPendencias(f.dir)[0].estado, 'pendente');
  atualizarPendencia(f.dir, pendencia.id, 'resolvida', `${rede}|triagem|prova:video`);
  const pronta = localizarFicha(f.dir, id);
  assert.equal(pronta.ficha.numero, ficha.ficha.numero);
  assert.ok(pronta.arquivo.endsWith('/concluidas/0001.md'));
  assert.equal(fs.existsSync(ficha.arquivo), false);
  fs.unlinkSync(arquivo(f.dir, 'pendencias-candidaturas.json'));
  assert.equal(lerPendencias(f.dir)[0].estado, 'resolvida');

  const resposta = { contexto: { empresa: 'Empresa Exemplo', vaga: 'Designer', id: rede, data: '2026-01-02' },
    campos: [{ pergunta: 'Prazo de início?', texto: 'Duas semanas', preenchida: true }] };
  assert.equal(registrarRespostas(resposta, { raizProjeto: f.raiz }).registrado, true);
  assert.equal(registrarRespostas(resposta, { raizProjeto: f.raiz }).registrado, false);
  assert.equal(localizarFicha(f.dir, id).ficha.respostas.length, 2);

  const velha = lerEstado(f.quadro, null);
  const atual = lerEstado(f.quadro, null);
  atual.vagas[outro].status = 'Entrevista';
  salvarEstado(f.quadro, atual, f.dir);
  assert.throws(() => salvarEstado(f.quadro, velha, f.dir), /Conflito de versão/);
  fs.unlinkSync(f.quadro);
  assert.equal(lerEstado(f.quadro, null).vagas[outro].status, 'Entrevista');
  assert.throws(() => migrarFichas(f.dir, 'restaurar'), /EXIGE_CONCILIACAO/);
});

test('retoma a operação interrompida entre a troca da ficha e a projeção', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: fichaQuadro('Aplicar', 'Designer') } });
  migrarFichas(f.dir);
  const estado = lerEstado(f.quadro, null);
  estado.vagas[id].status = 'Cancelada';
  const destino = arquivo(f.aplicacao, 'excluidas', '0001.md');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, 'conflito de teste');
  assert.throws(() => salvarEstado(f.quadro, estado, f.dir), /FICHA_DESTINO_EM_CONFLITO/);
  assert.throws(() => lerFichas(f.dir), /FICHAS_TRANSACAO_PENDENTE/);
  fs.unlinkSync(destino);
  assert.equal(migrarFichas(f.dir, 'recuperar').estado, 'recuperada');
  assert.equal(localizarFicha(f.dir, id).arquivo, destino);
  assert.equal(JSON.parse(fs.readFileSync(f.quadro)).vagas[id].status, 'Cancelada');
});

test('prevê conflito antes da troca, restaura o backup e respeita a configuração do Notion', t => {
  const f = fixture(t);
  const original = { vagas: { [id]: { ...fichaQuadro('Avaliar', 'Designer'), idsAlternativos: [rede] },
    [rede]: fichaQuadro('Aplicar', 'Designer') } };
  json(f.quadro, original);
  assert.throws(() => migrarFichas(f.dir, 'prever'), /FICHA_IDENTIDADE_AMBIGUA/);
  assert.equal(usaFichas(f.dir), false);
  delete original.vagas[rede];
  json(f.quadro, original);
  const originalBytes = fs.readFileSync(f.quadro);
  migrarFichas(f.dir);
  assert.equal(migrarFichas(f.dir, 'restaurar').estado, 'restaurada');
  assert.deepEqual(fs.readFileSync(f.quadro), originalBytes);
  assert.equal(usaFichas(f.dir), false);
  json(arquivo(f.dir, 'fonte-estado.json'), { fonte: 'notion', databaseId: 'exemplo' });
  assert.equal(migrarFichas(f.dir).estado, 'notion');
  assert.equal(usaFichas(f.dir), false);
  assert.deepEqual(fs.readFileSync(f.quadro), originalBytes);
});

test('registra pendência de chat no lote, permite avanço de outra ficha e atualiza a pendência na retomada', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: fichaQuadro('Aplicar', 'Designer'), [outro]: fichaQuadro('Aplicar', 'Researcher') } });
  migrarFichas(f.dir);
  const fila = { ids: [id, outro], provaRef: 'teste:fila' };
  const deps = { modoCandidatura: 'chrome_assistido', autorizadoCandidatura: true, consultarFila: () => fila };
  const { rodadaId } = operarLote(f.dir, 'iniciar', { frentes: ['aplicacao'], filaInicial: fila, leituraRegrasRef: 'teste:regras' }, deps);
  const atualizar = (id, estado) => operarLote(f.dir, 'atualizar', { rodadaId, id, estado, provaRef: 'teste:checkpoint' }, deps);
  atualizar(id, 'aguardando_pessoa');
  atualizar(outro, 'preparando');
  assert.match(localizarFicha(f.dir, id).arquivo, /pendentes/);
  assert.match(localizarFicha(f.dir, outro).arquivo, /fila/);
  atualizar(id, 'preparando');
  assert.match(localizarFicha(f.dir, id).arquivo, /fila/);
});


test('preserva a espera da v1.6 e deixa a vaga avançar em outra rodada', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: fichaQuadro('Aplicar', 'Designer') } });
  json(arquivo(f.dir, 'rodada-lote.json'), { contrato: 1, estado: 'encerrada', rodadaId: 'anterior',
    vagas: { [id]: { id, estado: 'aguardando_pessoa', provaRef: 'checkpoint:anterior' } } });
  migrarFichas(f.dir);
  assert.match(localizarFicha(f.dir, id).arquivo, /pendentes/);
  const fila = { ids: [id], provaRef: 'teste:fila' };
  const deps = { modoCandidatura: 'chrome_assistido', autorizadoCandidatura: true, consultarFila: () => fila };
  const { rodadaId } = operarLote(f.dir, 'iniciar', { frentes: ['aplicacao'], filaInicial: fila, leituraRegrasRef: 'teste:regras' }, deps);
  operarLote(f.dir, 'atualizar', { rodadaId, id, estado: 'preparando', provaRef: 'novo:checkpoint' }, deps);
  assert.match(localizarFicha(f.dir, id).arquivo, /fila/);
  assert.equal(localizarFicha(f.dir, id).ficha.etapas.anterior.estado, 'aguardando_pessoa');
});

test('coleta pode salvar primeira aparição de alias antes de associá-lo à ficha existente', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: fichaQuadro('Avaliar', 'Designer') } });
  migrarFichas(f.dir);
  const historico = arquivo(f.dir, 'historico.json');
  const ocorrencias = lerEstado(historico, { vagas: {} });
  ocorrencias.vagas[rede] = { dias: ['2026-01-02'] };
  salvarEstado(historico, ocorrencias, f.dir);
  assert.equal(localizarFicha(f.dir, rede), null);
  const quadro = lerEstado(f.quadro, null);
  quadro.vagas[id].idsAlternativos = [rede];
  salvarEstado(f.quadro, quadro, f.dir);
  const ficha = localizarFicha(f.dir, rede).ficha;
  assert.equal(ficha.id, id);
  assert.equal(ficha.numero, 1);
  assert.deepEqual(ficha.aparicoesPorId[rede].dias, ['2026-01-02']);
  assert.equal(lerFichas(f.dir).fichas.size, 1);
});

test('confirma o recibo com o aval da versão exata e recupera o registro inteiro após falha', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: fichaQuadro('Aplicar', 'Designer') } });
  migrarFichas(f.dir);
  const fila = { ids: [id], provaRef: 'teste:fila' };
  const deps = { modoCandidatura: 'chrome_assistido', autorizadoCandidatura: true, consultarFila: () => fila,
    gateEnvio: () => ({ aceito: true, provaRef: 'teste:aval' }) };
  const { rodadaId } = operarLote(f.dir, 'iniciar', { frentes: ['aplicacao'], filaInicial: fila, leituraRegrasRef: 'teste:regras' }, deps);
  const executar = (acao, args) => operarLote(f.dir, acao, { rodadaId, id, ...args }, deps);
  const hash = 'a'.repeat(64);
  const observacaoAlvoRef = 'teste:anuncio';
  const { vaga } = executar('fixar', { autor: 'Pessoa A', pacoteHash: hash,
    fontes: [{ ref: 'teste:fonte', hash }], observacaoAlvoRef });
  const pacoteHash = vaga.pacote.hash;
  executar('revisar', { revisor: 'Pessoa B', aprovada: true, pacoteHash, observacaoAlvoRef, provaRef: 'teste:parecer' });
  executar('liberar_envio', { pacoteHash });
  assert.throws(() => executar('confirmar_envio', { pacoteHash }), /CONFIRMACAO_EXTERNA_OBRIGATORIA/);
  const destino = arquivo(f.aplicacao, 'concluidas/0001.md');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, 'conflito de teste');
  assert.throws(() => executar('confirmar_envio', { pacoteHash, provaRef: 'teste:recibo-simulado' }), /FICHA_DESTINO_EM_CONFLITO/);
  const lote = () => JSON.parse(fs.readFileSync(arquivo(f.dir, 'rodada-lote.json')));
  assert.equal(lote().vagas[id].estado, 'liberada');
  fs.unlinkSync(destino);
  assert.equal(migrarFichas(f.dir, 'recuperar').estado, 'recuperada');
  const ficha = localizarFicha(f.dir, id);
  assert.equal(ficha.arquivo, destino);
  assert.equal(ficha.ficha.quadro.status, 'Aplicado por IA');
  assert.equal(ficha.ficha.tentativas[0].provaRef, 'teste:recibo-simulado');
  assert.equal(lote().vagas[id].estado, 'enviada');
});


test('o planejamento bloqueia também o ID principal quando a ação pessoal está registrada por alias', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: { ...fichaQuadro('Aplicar', 'Designer'), idsAlternativos: [rede] } } });
  migrarFichas(f.dir);
  registrarPendencias(f.dir, [pendencia]);
  const fila = { ids: [id], provaRef: 'teste:fila' };
  const deps = { modoCandidatura: 'chrome_assistido', autorizadoCandidatura: true, consultarFila: () => fila };
  operarLote(f.dir, 'iniciar', { frentes: ['aplicacao'], filaInicial: fila, leituraRegrasRef: 'teste:regras' }, deps);
  const plano = operarLote(f.dir, 'planejar', {}, deps);
  assert.deepEqual(plano.naoPercorridas, []);
  assert.deepEqual(plano.ordemAplicacao, []);
  assert.equal(plano.podePerguntar, true);
  assert.equal(plano.pendenciasPessoais[0].idCanonico, rede);
});

test('dois IDs da mesma requisição entram uma vez no lote e o desfecho não se repete pelo alias', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: { ...fichaQuadro('Aplicar', 'Designer'), idsAlternativos: [rede] } } });
  migrarFichas(f.dir);
  const fila = { ids: [id, rede], provaRef: 'teste:fila' };
  const deps = { modoCandidatura: 'chrome_assistido', autorizadoCandidatura: true, consultarFila: () => fila,
    gateEnvio: () => ({ aceito: true, provaRef: 'teste:aval' }) };
  const { rodadaId } = operarLote(f.dir, 'iniciar', { frentes: ['aplicacao'], filaInicial: fila, leituraRegrasRef: 'teste:regras' }, deps);
  const lote = () => JSON.parse(fs.readFileSync(arquivo(f.dir, 'rodada-lote.json')));
  assert.deepEqual(Object.keys(lote().vagas), [id]);
  const plano = operarLote(f.dir, 'planejar', {}, deps);
  assert.deepEqual(plano.ordemAplicacao.map(v => v.id), [id]);
  assert.deepEqual(plano.identidadesAmbiguas, []);

  // A origem alternativa conduz a mesma vaga do lote até o recibo.
  const executar = (acao, args, alvo = rede) => operarLote(f.dir, acao, { rodadaId, id: alvo, ...args }, deps);
  const hash = 'b'.repeat(64);
  const observacaoAlvoRef = 'teste:anuncio';
  const { vaga } = executar('fixar', { autor: 'Pessoa A', pacoteHash: hash, fontes: [{ ref: 'teste:fonte', hash }], observacaoAlvoRef });
  assert.equal(vaga.id, id);
  const pacoteHash = vaga.pacote.hash;
  executar('revisar', { revisor: 'Pessoa B', aprovada: true, pacoteHash, observacaoAlvoRef, provaRef: 'teste:parecer' }, id);
  executar('liberar_envio', { pacoteHash });
  executar('confirmar_envio', { pacoteHash, provaRef: 'teste:recibo-ficticio' });
  assert.throws(() => executar('confirmar_envio', { pacoteHash, provaRef: 'teste:segundo-recibo' }, id), /VAGA_TERMINAL/);
  assert.throws(() => executar('confirmar_envio', { pacoteHash, provaRef: 'teste:segundo-recibo' }), /VAGA_TERMINAL/);
  assert.throws(() => executar('atualizar', { estado: 'preparando', provaRef: 'teste:retomada' }), /VAGA_TERMINAL/);
  assert.deepEqual(Object.keys(lote().vagas), [id]);
  assert.equal(lote().vagas[id].provaRef, 'teste:recibo-ficticio');

  const { ficha, arquivo: md } = localizarFicha(f.dir, rede);
  assert.equal(ficha.id, id);
  assert.equal(lerFichas(f.dir).fichas.size, 1);
  assert.deepEqual(ficha.tentativas, [{ tentativaId: `lote:${rodadaId}:${id}`, desfecho: 'confirmado',
    provaRef: 'teste:recibo-ficticio', origem: 'lote', idLote: id }]);
  assert.equal(ficha.etapas[rodadaId].idLote, id);
  assert.equal(ficha.quadro.status, 'Aplicado por IA');
  assert.equal(ficha.quadro.historico.filter(h => h.para === 'Aplicado por IA').length, 1);
  assert.equal(ficha.quadro.historico.at(-1).por, 'lote');
  const texto = fs.readFileSync(md, 'utf8');
  assert.match(texto, /referência registrada no lote/);
  assert.doesNotMatch(texto, /segundo\\-recibo|segundo-recibo/);
});

test('envio registrado na primeira rodada fecha preparo e liberação pelo alias na segunda, com registro final único', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: { ...fichaQuadro('Aplicar', 'Designer'), idsAlternativos: [rede] } } });
  migrarFichas(f.dir);
  let fila = { ids: [id, rede], provaRef: 'teste:fila-1' };
  const deps = { modoCandidatura: 'chrome_assistido', autorizadoCandidatura: true, consultarFila: () => fila,
    gateEnvio: () => ({ aceito: true, provaRef: 'teste:aval' }) };
  const hash = 'c'.repeat(64);
  const observacaoAlvoRef = 'teste:anuncio';
  const fixar = (rodadaId, alvo) => operarLote(f.dir, 'fixar', { rodadaId, id: alvo, autor: 'Pessoa A', pacoteHash: hash,
    fontes: [{ ref: 'teste:fonte', hash }], observacaoAlvoRef }, deps);

  const primeira = operarLote(f.dir, 'iniciar', { frentes: ['aplicacao'], filaInicial: fila, leituraRegrasRef: 'teste:regras' }, deps).rodadaId;
  const pacoteHash = fixar(primeira, rede).vaga.pacote.hash;
  operarLote(f.dir, 'revisar', { rodadaId: primeira, id: rede, revisor: 'Pessoa B', aprovada: true, pacoteHash, observacaoAlvoRef, provaRef: 'teste:parecer' }, deps);
  operarLote(f.dir, 'liberar_envio', { rodadaId: primeira, id: rede, pacoteHash }, deps);
  // Mesmo lote com aval: um recibo registrado antes pela operação ainda é reconciliado.
  gravarTentativaFicha(f.dir, { chave: rede, tentativaId: 't-operacao', desfecho: 'confirmado', provaRef: 'teste:recibo-ficticio' });
  assert.deepEqual(operarLote(f.dir, 'planejar', {}, deps).ordemAplicacao.map(v => v.id), [id]);
  operarLote(f.dir, 'confirmar_envio', { rodadaId: primeira, id: rede, pacoteHash, provaRef: 'teste:recibo-ficticio' }, deps);
  operarLote(f.dir, 'encerrar', { rodadaId: primeira, provaRef: 'teste:fim-1' }, deps);

  fila = { ids: [rede], provaRef: 'teste:fila-2' };
  const segunda = operarLote(f.dir, 'iniciar', { frentes: ['aplicacao'], filaInicial: fila, leituraRegrasRef: 'teste:regras' }, deps).rodadaId;
  const plano = operarLote(f.dir, 'planejar', {}, deps);
  assert.deepEqual(plano.naoPercorridas, []);
  assert.deepEqual(plano.ordemAplicacao, []);
  assert.deepEqual(plano.trabalhoIndependente, []);
  assert.deepEqual(plano.enviosRegistrados, [id]);
  assert.equal(plano.podeAplicar, false);
  for (const alvo of [rede, id]) {
    assert.throws(() => fixar(segunda, alvo), /ENVIO_JA_REGISTRADO/);
    assert.throws(() => operarLote(f.dir, 'atualizar', { rodadaId: segunda, id: alvo, estado: 'preparando', provaRef: 'teste:x' }, deps), /ENVIO_JA_REGISTRADO/);
    assert.throws(() => operarLote(f.dir, 'liberar_envio', { rodadaId: segunda, id: alvo, pacoteHash }, deps), /ENVIO_JA_REGISTRADO/);
    assert.throws(() => operarLote(f.dir, 'confirmar_envio', { rodadaId: segunda, id: alvo, pacoteHash, provaRef: 'teste:outro' }, deps), /ACEITE_EXATO_OBRIGATORIO/);
  }

  const { ficha } = localizarFicha(f.dir, rede);
  assert.equal(lerFichas(f.dir).fichas.size, 1);
  assert.deepEqual(ficha.tentativas.map(x => x.tentativaId).sort(), ['t-operacao', `lote:${primeira}:${id}`].sort());
  assert.equal(ficha.tentativas.some(x => x.tentativaId.includes(segunda)), false);
  assert.equal(ficha.quadro.historico.filter(h => h.para === 'Aplicado por IA').length, 1);
  assert.equal(JSON.parse(fs.readFileSync(arquivo(f.dir, 'rodada-lote.json'))).vagas[id].estado, 'nao_percorrida');
});

test('tentativa incerta de outro lote fecha preparo pelo alias', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: { ...fichaQuadro('Aplicar', 'Designer'), idsAlternativos: [rede] } } });
  migrarFichas(f.dir);
  gravarTentativaFicha(f.dir, { chave: id, tentativaId: 't-incerta' });
  const fila = { ids: [rede], provaRef: 'teste:fila' };
  const deps = { modoCandidatura: 'chrome_assistido', autorizadoCandidatura: true, consultarFila: () => fila };
  const { rodadaId } = operarLote(f.dir, 'iniciar', { frentes: ['aplicacao'], filaInicial: fila, leituraRegrasRef: 'teste:regras' }, deps);
  assert.deepEqual(operarLote(f.dir, 'planejar', {}, deps).ordemAplicacao, []);
  assert.throws(() => operarLote(f.dir, 'atualizar', { rodadaId, id: rede, estado: 'preparando', provaRef: 'teste:x' }, deps), /ENVIO_JA_REGISTRADO/);
  // Registrar a espera por uma ação humana continua possível.
  operarLote(f.dir, 'atualizar', { rodadaId, id: rede, estado: 'aguardando_pessoa', provaRef: 'teste:video' }, deps);
});

test('lote com duas chaves da mesma ficha fica fora do plano e recusa ação até conferência', t => {
  const f = fixture(t);
  json(f.quadro, { vagas: { [id]: { ...fichaQuadro('Aplicar', 'Designer'), idsAlternativos: [rede] } } });
  migrarFichas(f.dir);
  const vaga = chave => ({ id: chave, estado: 'nao_percorrida', origem: 'filaInicial', provaRef: 'teste:fila', versao: 0, pacote: null, revisao: null, aceite: null });
  json(arquivo(f.dir, 'rodada-lote.json'), { contrato: 1, origem: 'manual', estado: 'ativa', rodadaId: 'rodada-legada', frentes: ['aplicacao'],
    coleta2: { estado: 'dispensada', motivo: 'frente_coleta_ausente' }, captura: { estado: 'dispensada', provaRef: null },
    vagas: { [id]: vaga(id), [rede]: vaga(rede) }, houvePerguntas: false, perguntas: { estado: 'pendente', provaRef: null },
    melhorias: { estado: 'nao_oferecida', provaRef: null } });
  const fila = { ids: [id], provaRef: 'teste:fila' };
  const deps = { modoCandidatura: 'chrome_assistido', autorizadoCandidatura: true, consultarFila: () => fila };
  const plano = operarLote(f.dir, 'planejar', {}, deps);
  assert.deepEqual(plano.identidadesAmbiguas, [{ ficha: id, ids: [id, rede] }]);
  assert.deepEqual(plano.ordemAplicacao, []);
  assert.deepEqual(plano.naoPercorridas, []);
  assert.equal(plano.podeAplicar, false);
  assert.throws(() => operarLote(f.dir, 'atualizar', { rodadaId: 'rodada-legada', id: rede, estado: 'preparando', provaRef: 'teste:x' }, deps),
    /FICHA_FILA_IDENTIDADE_DUPLICADA/);
});

test('coleta 2 reconhece alias de vaga já na fila e preserva os IDs das passagens revisadas', t => {
  const f = fixture(t);
  const nova = 'portal:303';
  const novaRede = 'linkedin:303';
  json(f.quadro, { vagas: {
    [id]: { ...fichaQuadro('Aplicar', 'Designer'), idsAlternativos: [rede] },
    [nova]: { ...fichaQuadro('Avaliar', 'Researcher'), idsAlternativos: [novaRede] },
  } });
  migrarFichas(f.dir);
  let fila = { ids: [id], provaRef: 'teste:fila-1' };
  const deps = { consultarFila: () => fila };
  const { rodadaId } = operarLote(f.dir, 'iniciar', { frentes: ['coleta'], coleta2Habilitada: true, filaInicial: fila, leituraRegrasRef: 'teste:regras' }, deps);
  operarLote(f.dir, 'captura', { rodadaId, estado: 'encerrada', provaRef: 'teste:captura', integracaoRef: 'teste:integracao', arquivosRef: 'teste:arquivos' }, deps);
  const feedRunId = crypto.randomUUID();
  operarLote(f.dir, 'coleta2_decidir', { rodadaId, decisao: 'aceita', provaRef: 'teste:aceite', feedRunId }, deps);

  fila = { ids: [rede, novaRede], provaRef: 'teste:fila-2' };
  const relatorio = arquivo(f.dir, 'linkedin-feed', feedRunId, 'integracao.json');
  fs.mkdirSync(path.dirname(relatorio), { recursive: true });
  json(relatorio, { runId: feedRunId, concluida: true, confirmadas: [{ idExterno: rede }, { idExterno: novaRede }],
    pendentes: [], falhas: [], triagemPendente: 0 });
  const saida = operarLote(f.dir, 'coleta2_captura', { rodadaId, estado: 'encerrada', provaRef: 'teste:captura-2',
    arquivosRef: 'teste:arquivos-2', runId: feedRunId, integracaoRef: relatorio }, deps);
  assert.deepEqual(saida.coleta2, { runId: feedRunId, novasIntegradas: 1 });

  const lote = JSON.parse(fs.readFileSync(arquivo(f.dir, 'rodada-lote.json')));
  assert.deepEqual(Object.keys(lote.vagas).sort(), [id, nova]);
  assert.equal(lote.vagas[id].origem, 'filaInicial');
  assert.equal(lote.vagas[nova].origem, 'coleta2');
  assert.deepEqual(lote.coleta2.filaAntes, { ids: [id], provaRef: 'teste:fila-1' });
  assert.deepEqual(lote.coleta2.idsIntegrados, [nova]);
  assert.equal(lote.coleta2.aceiteRef, 'teste:aceite');
  assert.equal(lote.coleta2.feedRunId, feedRunId);
  assert.equal(lote.coleta2.integracaoRunId, feedRunId);
  assert.equal(lote.coleta2.integracaoRef, relatorio);
  assert.deepEqual(JSON.parse(fs.readFileSync(relatorio)).confirmadas.map(c => c.idExterno), [rede, novaRede]);
  // Sem os dois opt-ins, o aceite da coleta 2 não libera aplicação das novas.
  assert.equal(lote.coleta2.aplicarNovas, undefined);
});
