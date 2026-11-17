import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publico = existsSync(join(raiz, 'src/fonte-estado.js'));
const salvar = (p, v) => writeFileSync(p, JSON.stringify(v));
const ler = p => JSON.parse(readFileSync(p, 'utf8'));

function fixture(t, modo = 'notion') {
  const pasta = join(raiz, 'data'); mkdirSync(pasta, { recursive: true });
  const base = mkdtempSync(join(pasta, 'feed-cli-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const dados = join(base, 'data'), config = join(base, 'config'); mkdirSync(dados); mkdirSync(config);
  salvar(join(config, 'linkedin-feed.json'), { habilitado: true });
  salvar(join(config, 'perfil.json'), { _configurado: true, cargo_alvo: 'Product Designer', exigir_remoto: true, modelo_desconhecido_passa: false,
    senioridade: { descartadas: ['junior'] }, ingles: { desconto_forte: 0, desconto_desejavel: 0 },
    frescor: { nova_ate: 7, recente_ate: 21, parada_ate: 45 },
    salario: { minimo_mensal_brl: 0, cambio: { BRL: 1 }, referencia_atual_brl: 0 },
    limites: { teto_nao_validada: 55, teto_fonte_solta: 60 },
    pesos: { titulo_max: 20, sinais_max: 15, semantico_max: 40 } });
  salvar(join(config, 'palavras-chave.json'), { titulo_aceito: { 'product designer': 20 },
    titulo_excluido: [], cargo_excluido: [], nivel_excluido: [], senioridade_excluida: [],
    descricao_excluida: [], dominio_alto: [], dominio_medio: [], sinais: ['figma'],
    exige_ingles_forte: [], exige_ingles_desejavel: [], cargos_da_area: ['designer'] });
  salvar(join(config, 'dorks.json'), {});
  if (publico) salvar(join(dados, 'fonte-estado.json'), modo === 'notion' ? { fonte: 'notion', databaseId: 'database-sintetica' } : { fonte: 'local' });
  if (publico) salvar(join(dados, 'onboarding-humano.json'), { versao:1, origem:'html-local', confirmadoPelaPessoa:true, passos:[1,2,3,4,5,6,7], concluidoEm:new Date().toISOString() });
  const env = { ...process.env, VAGAS_DIR_DADOS: dados, VAGAS_DIR_CONFIG: config, VAGAS_SEM_ENV: '1', VAGAS_FUSO: 'America/Sao_Paulo' };
  delete env.VAGAS_OPERACAO_TOKEN;
  const cli = (...args) => spawnSync(process.execPath, [join(raiz, 'scripts/linkedin-feed.mjs'), ...args], { cwd: raiz, env, encoding: 'utf8', maxBuffer: 2e6 });
  const codigo = code => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: raiz, env, encoding: 'utf8', maxBuffer: 2e6 });
    assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout);
  };
  const pronto = () => codigo(`
    import {executar,consultar} from ${JSON.stringify(pathToFileURL(join(raiz, 'src/linkedin-feed-sessao.js')).href)};
    const base=Date.now()-1900000, comum={dirDados:process.env.VAGAS_DIR_DADOS,fuso:'America/Sao_Paulo',dono:'ensaio-sintetico'};
    const hora=s=>new Date(base+s*1000).toISOString();
    executar({...comum,acao:'iniciar',agora:hora(0),aceiteRef: 'fixture:aceite', browserLiberadoRef:'fixture:nao-e-navegacao-real'});
    executar({...comum,acao:'observar',agora:hora(1),observacao:{cargo:'Senior Product Designer',empresa:'Empresa Exemplo',url:'https://www.linkedin.com/posts/exemplo-post',linkCandidatura:'https://empresa-exemplo.gupy.io/jobs/12345',origem:'feed',referencia:'fixture:post-1'}});
    executar({...comum,acao:'observar',agora:hora(2),observacao:{cargo:'Brand Designer',url:'https://www.linkedin.com/posts/exemplo-dm',referencia:'fixture:dm-sem-link'}});
    for(let i=0;i<30;i++)executar({...comum,acao:'intervalo',rota:i<15?'jobs':i<27?'postagens':'feed',agora:hora((i+1)*60),inicioEm:hora(i*60),fimEm:hora((i+1)*60),evidenciaInicio:'fixture:inicio-'+i,evidenciaFim:'fixture:fim-'+i,provaRef:'fixture:simulada-'+i});
    executar({...comum,acao:'concluir',agora:hora(1801),referencia:'fixture:30min-simulados'});
    console.log(JSON.stringify(consultar({...comum})));
  `);
  const revisoes = sessao => {
    const p = join(base, 'revisoes.json');
    salvar(p, [{ idObservacao: sessao.observacoes[0].id, vagaRevisada: {
      titulo: 'Senior Product Designer', empresa: 'Empresa Exemplo', descricao: 'Product Designer para produto digital remoto. Figma e protótipos.',
      validada: true, encerrada: false, modelo: 'remoto', remoto: true, pais: 'Brasil', resumo: 'Produto digital da Empresa Exemplo.', gaps: 'Conferir escopo com a empresa.', semantico: 28 },
      revisao: { aberta: true, canal: 'link', paisCompativel: true, modeloCompativel: true,
        eixos: [1, 2, 3, 4].map(n => ({ nota: 7, justificativa: 'Cobertura parcial na fixture '+n, evidencia: 'Trecho sintético '+n, fonte: 'fixture:base-e-anuncio' })) } },
      { idObservacao: sessao.observacoes[1].id,
        desfecho: { idObservacao: sessao.observacoes[1].id, tipo: 'pista', criterio: 'canal_incompleto',
          motivo: 'Post sem link de candidatura', evidencia: 'Fixture do post sem link',
          fonte: 'fixture:dm-sem-link', verificadoEm: '2026-11-13', alcance: 'esta observação',
          lacuna: 'Não há link nem requisição identificada', proximaAcao: 'Conferir o post antes de abrir vaga nova' } }]);
    return p;
  };
  const estado = (vagas, completo = true) => {
    const p = join(base, 'estado.json'); salvar(p, { fonte: 'notion', consultadoEm: new Date().toISOString(), completo, provaRef: 'fixture:consulta-simulada', vagas }); return p;
  };
  return { dados, base, config, cli, codigo, pronto, revisoes, estado };
}
function ok(r) { assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); }

// No público a configuração não vem de VAGAS_DIR_CONFIG; o aceite do LinkedIn está coberto em linkedin-feed-sessao.test.js.
test('entrada respeita aplicação isolada/opt-out; relógio real da CLI não aceita injeção', { skip: 'o público ainda não lê VAGAS_DIR_CONFIG' }, t => {
  const f = fixture(t);
  assert.equal(ok(f.cli('planejar', '--frente', 'aplicacao')).acao, 'desabilitada');
  assert.equal(existsSync(join(f.dados, 'linkedin-feed')), false);
  salvar(join(f.config, 'linkedin-feed.json'), { habilitado: false });
  assert.equal(ok(f.cli('planejar')).acao, 'desabilitada');
  assert.notEqual(f.cli('iniciar', '--dono', 'teste').status, 0);
  salvar(join(f.config, 'linkedin-feed.json'), { habilitado: true });
  const input = join(f.base, 'inicio.json'); salvar(input, { aceiteRef: 'fixture:aceite', browserLiberadoRef: 'fixture:livre', agora: '2000-01-01T00:00:00.000Z' });
  assert.match(f.cli('iniciar', '--dono', 'teste', '--arquivo', input).stderr, /OPCOES_RESERVADAS/);
  salvar(input, { browserLiberadoRef: 'fixture:livre' });
  assert.match(f.cli('iniciar', '--dono', 'teste', '--arquivo', input).stderr, /CAMPO_INVALIDO:aceiteRef/);
  salvar(input, { aceiteRef: 'fixture:aceite', browserLiberadoRef: 'fixture:livre' }); ok(f.cli('iniciar', '--dono', 'teste', '--arquivo', input));
  assert.match(f.cli('preparar', '--dono', 'teste').stderr, /CAPTURA_AINDA_NAO_CONCLUIDA/);
  const plano = ok(f.cli('planejar'));
  assert.equal(plano.rotaAtual, 'jobs');
  assert.deepEqual(plano.rotas.map(r => r.restantes), [900, 720, 180]);
  const fim = Date.now(), inicio = fim - 1000;
  // Datas posteriores ao início da sessão; ausência de rota nunca adquire crédito.
  const sessao = ok(f.cli('status'));
  const inicioValido = Math.max(Date.parse(sessao.segmentoInicioEm), inicio);
  const fimValido = Math.max(inicioValido + 1, fim);
  salvar(input, { inicioEm: new Date(inicioValido).toISOString(), fimEm: new Date(fimValido).toISOString(),
    evidenciaInicio: 'fixture:inicio', evidenciaFim: 'fixture:fim', provaRef: 'fixture:intervalo' });
  assert.match(f.cli('intervalo', '--dono', 'teste', '--arquivo', input).stderr, /ROTA_OBRIGATORIA/);
  assert.equal(ok(f.cli('status')).segundosAtivos, 0);
});

test('Notion exige consulta completa para dedupe e releitura da página para confirmar; espelho alheio é preservado', t => {
  const f = fixture(t), s = f.pronto(), revisoes = f.revisoes(s);
  const anterior = { status: 'Cancelada', titulo: 'Outra vaga', empresa: 'Outra Empresa', url: 'https://example.org/vaga-antiga', paginaId: 'pagina-antiga' };
  const base = { versao: 1, sincronizadoEm: '2026-01-01T00:00:00.000Z', vagas: { 'gupy:99999': anterior } };
  if (publico) Object.assign(base, { fonte: 'notion', databaseId: 'database-sintetica', paginacao: { completa: true, paginas: 1 } });
  salvar(join(f.dados, 'notion.json'), base);
  assert.match(f.cli('preparar', '--dono', 'ensaio-sintetico', '--revisoes', revisoes, '--estado', f.estado({}, false)).stderr, /CONSULTA_INCOMPLETA/);
  const plano = ok(f.cli('preparar', '--dono', 'ensaio-sintetico', '--revisoes', revisoes, '--estado', f.estado({ 'gupy:99999': anterior })));
  assert.equal(plano.contagem.novas, 1, JSON.stringify(plano)); assert.equal(plano.contagem.pistas, 1); assert.equal(plano.gravacao, 'pendente');
  const incompleta = ok(f.cli('confirmar', '--dono', 'ensaio-sintetico', '--estado', f.estado({})));
  assert.equal(incompleta.concluida, false); assert.deepEqual(incompleta.pendentes, ['gupy:12345']);
  assert.equal(existsSync(join(f.dados, 'vagas.json')), false);
  const linha = { status: 'Avaliar', titulo: 'Senior Product Designer', empresa: 'Empresa Exemplo', url: 'https://empresa-exemplo.gupy.io/jobs/12345', paginaId: 'pagina-nova' };
  if (publico) salvar(join(f.dados, 'notion.json'), { ...base, vagas: { ...base.vagas, 'gupy:12345': linha } });
  const r = ok(f.cli('confirmar', '--dono', 'ensaio-sintetico', '--estado', f.estado({ 'gupy:12345': linha }, false)));
  assert.equal(r.concluida, true); assert.equal(r.confirmadas.length, 1);
  const espelho = ler(join(f.dados, 'notion.json'));
  assert.deepEqual(espelho.vagas['gupy:99999'], anterior);
  assert.equal(espelho.sincronizadoEm, base.sincronizadoEm);
  assert.equal(ler(join(f.dados, 'vagas.json')).vagas['gupy:12345'].noNotion, true);
  assert.equal(ler(join(f.dados, 'semantico.json')).julgamentos['gupy:12345'].nota, 28);
  assert.equal(ler(join(f.dados, 'leituras/gupy-12345-feed.json')).eixos.length, 4);
  assert.equal(ok(f.cli('planejar')).acao, 'dispensar');
});

test('proveniência: quadro conhecido permite cache ausente; alias existente é relido; ausência nos dois bloqueia', t => {
  for (const caso of ['semCache', 'alias', 'desconhecida']) {
    const f = fixture(t), s = f.pronto();
    const linha = { status: 'Cancelada', empresa: 'Empresa Exemplo', titulo: 'Senior Product Designer',
      url: 'https://empresa-exemplo.gupy.io/jobs/12345', paginaId: 'pagina-existente' };
    const base = { versao: 1, sincronizadoEm: new Date().toISOString(), vagas: { 'gupy:12345': linha } };
    if (publico) Object.assign(base, { fonte: 'notion', databaseId: 'database-sintetica', paginacao: { completa: true, paginas: 1 } });
    salvar(join(f.dados, 'notion.json'), base);
    salvar(join(f.dados, 'vagas.json'), { versao: 1, vagas: { 'gupy:12345': { idExterno: 'gupy:12345', titulo: linha.titulo, empresa: linha.empresa, link: linha.url } } });
    const p = ok(f.cli('preparar', '--dono', 'ensaio-sintetico', '--revisoes', f.revisoes(s), '--estado', f.estado(base.vagas)));
    assert.equal(p.novas.length, 0); assert.equal(p.atualizacoesOrigem.length, 1);
    const cache = caso === 'alias' ? { 'linkedin:87654': { idExterno: 'linkedin:87654', idsAlternativos: ['gupy:12345'], link: linha.url } } : {};
    salvar(join(f.dados, 'vagas.json'), { versao: 1, vagas: cache });
    const r = ok(f.cli('confirmar', '--dono', 'ensaio-sintetico', '--estado', f.estado(caso === 'desconhecida' ? {} : base.vagas, false)));
    assert.equal(r.concluida, caso !== 'desconhecida');
    if (caso === 'semCache') assert.deepEqual(r.semCache, ['gupy:12345']);
    if (caso === 'desconhecida') assert.match(r.falhas[0].erro, /PROVENIENCIA_CACHE_AUSENTE/);
    if (caso === 'alias') assert.deepEqual(ler(join(f.dados, 'vagas.json')).vagas['linkedin:87654'].origemFeed, ['https://www.linkedin.com/posts/exemplo-post']);
    assert.equal(ler(join(f.dados, 'notion.json')).vagas['gupy:12345'].status, 'Cancelada');
  }
});

test('sem desfecho da observação o lote não integra; pacote com cobertura adulterada é recusado', t => {
  const f = fixture(t), s = f.pronto(), caminho = f.revisoes(s);
  if (publico) salvar(join(f.dados, 'notion.json'), { versao: 1, sincronizadoEm: new Date().toISOString(), fonte: 'notion', databaseId: 'database-sintetica', paginacao: { completa: true, paginas: 1 }, vagas: {} });
  salvar(caminho, ler(caminho).slice(0, 1));
  const p = ok(f.cli('preparar', '--dono', 'ensaio-sintetico', '--revisoes', caminho, '--estado', f.estado({})));
  assert.equal(p.pendencias.length, 1);
  assert.equal(ok(f.cli('confirmar', '--dono', 'ensaio-sintetico', '--estado', f.estado({}, false))).concluida, false);
  const pacote = join(f.dados, 'linkedin-feed', s.runId, 'publicacao.json');
  const adulterado = ler(pacote);
  adulterado.pendencias = [];
  salvar(pacote, adulterado);
  assert.match(f.cli('confirmar', '--dono', 'ensaio-sintetico', '--estado', f.estado({}, false)).stderr, /PACOTE_DESATUALIZADO/);
});

test('público local publica e relê o quadro sem criar espelho Notion', { skip: !publico }, t => {
  const f = fixture(t, 'local'), s = f.pronto();
  const r = ok(f.cli('publicar', '--dono', 'ensaio-sintetico', '--revisoes', f.revisoes(s)));
  assert.equal(r.concluida, true); assert.equal(r.confirmadas.length, 1);
  assert.equal(ler(join(f.dados, 'quadro.json')).vagas['gupy:12345'].status, 'Avaliar');
  assert.equal(existsSync(join(f.dados, 'notion.json')), false);
});
