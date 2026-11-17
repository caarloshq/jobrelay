import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararLote } from '../src/linkedin-feed.js';

const base = (n, extras = {}) => ({
  chave: `captura-${n}`, titulo: 'Senior Product Designer', empresa: 'Empresa Exemplo',
  postOriginal: `https://www.linkedin.com/posts/exemplo_${n}`,
  urlCandidatura: `https://www.linkedin.com/jobs/view/${n}?utm_source=feed`,
  evidencia: `captura sintética ${n}`,
  vagaRevisada: { validada: true, descricao: 'Senior Product Designer remoto em produto digital.',
    resumo: 'Atuação em produto digital.', gaps: ['Domínio específico não informado'], modelo: 'remoto', semantico: 20 },
  revisao: { aberta: true, canal: 'link', paisCompativel: true, modeloCompativel: true,
    eixos: [1, 2, 3, 4].map((i) => ({ nota: 5, evidencia: `Trecho ${i}`,
      justificativa: `Relação factual ${i}`, fonte: `Anúncio ${i}` })) },
  ...extras,
});
const desfecho = (id, tipo, criterio, extras = {}) => ({
  idObservacao: id, tipo, criterio, motivo: `Conclusão factual ${criterio}`,
  evidencia: `Trecho conferido para ${criterio}`, fonte: 'fixture:pagina-da-vaga',
  verificadoEm: '2026-11-13', alcance: 'esta observação', ...extras,
});
const pista = (id, criterio, extras = {}) => desfecho(id, 'pista', criterio, {
  lacuna: `Identidade ou leitura pendente: ${criterio}`,
  proximaAcao: 'Conferir o destino no navegador antes de publicar.', ...extras,
});

test('observacao simples e DM ficam fora da fila', () => {
  const r = prepararLote({ observacoes: [
    { chave: 'sem-revisao', titulo: 'Senior Product Designer', empresa: 'A', urlCandidatura: 'https://www.linkedin.com/jobs/view/11111111' },
    { chave: 'dm', titulo: 'Senior Product Designer', empresa: 'B', postOriginal: 'https://www.linkedin.com/posts/b_1', canal: 'DM', desfecho: pista('dm', 'canal_incompleto') },
  ] });
  assert.equal(r.novas.length, 0);
  assert.equal(r.pendencias.length, 1);
  assert.equal(r.pistas.length, 1);
});

test('vaga revisada entra com fonte LinkedIn, proveniencia e nota apenas ordenadora', () => {
  const r = prepararLote({ observacoes: [base(11111111)], agora: '2026-11-09T12:00:00Z' });
  assert.equal(r.novas.length, 1);
  assert.equal(r.novas[0].idExterno, 'linkedin:11111111');
  assert.equal(r.novas[0].fonte, 'LinkedIn');
  assert.deepEqual(r.novas[0].origemFeed, ['https://www.linkedin.com/posts/exemplo_11111111']);
  assert.equal(typeof r.novas[0].compatibilidade, 'number');
  assert.equal(r.novas[0].lida, true);
  assert.equal(typeof r.novas[0].faixa, 'string');
});

test('ATS resolvida com evidencia conserva alias LinkedIn e nao vira Solta', () => {
  const r = prepararLote({ observacoes: [base(22222222, {
    urlResolvida: 'https://jobs.smartrecruiters.com/Empregador/743999000000001-designer',
    evidenciaResolucao: 'Destino conferido no navegador',
  })] });
  assert.equal(r.novas[0].idExterno, 'smartrecruiters:743999000000001');
  assert.equal(r.novas[0].fonte, 'SmartRecruiters');
  assert.ok(r.novas[0].idsAlternativos.includes('linkedin:22222222'));
});

test('cache pendente reconcilia; terminal do quadro nao reabre; nova permanece', () => {
  const r = prepararLote({
    observacoes: [base(33333333), base(44444444, { empresa: 'Outra Empresa' }),
      base(55555555, { empresa: 'Terceira Empresa' })],
    cache: { vagas: { 'linkedin:33333333': { idExterno: 'linkedin:33333333', link: 'https://www.linkedin.com/jobs/view/33333333' } } },
    estado: { vagas: { 'linkedin:44444444': { status: 'Aplicado por IA', url: 'https://www.linkedin.com/jobs/view/44444444' } } },
  });
  assert.equal(r.duplicatas.length, 1);
  assert.equal(r.duplicatas[0].motivo, 'ja concluida no quadro');
  assert.equal(r.novas.length, 2);
  assert.equal(r.novas.find((v) => v.idExterno === 'linkedin:33333333').publicacaoPendente, true);
  assert.ok(r.novas.some((v) => v.idExterno === 'linkedin:55555555'));
});

test('duas requisicoes fortes distintas ficam separadas; identidade fraca vira pendencia', () => {
  const url = (id) => `https://jobs.smartrecruiters.com/EmpresaExemplo/${id}-designer`;
  const observacoes = [
    base(10000001, { titulo: '(1234) Senior Product Designer', urlCandidatura: url('743999000000011') }),
    base(10000002, { titulo: '(5678) Senior Product Designer', urlCandidatura: url('743999000000012') }),
    base(10000003, { titulo: 'Senior Product Designer', urlCandidatura: url('743999000000013') }),
  ];
  const r = prepararLote({ observacoes });
  assert.equal(r.novas.length, 2);
  assert.equal(r.pendencias.length, 1);
});

test('link de post nao vira candidatura e vaga junior respeita filtro', () => {
  const r = prepararLote({ observacoes: [
    base(66666666, { urlCandidatura: 'https://www.linkedin.com/posts/exemplo_66666666',
      desfecho: pista('captura-66666666', 'sem_destino') }),
    base(77777777, { titulo: 'Junior Product Designer',
      desfecho: desfecho('captura-77777777', 'descartada', 'fora_perfil') }),
  ] });
  assert.equal(r.pistas.length, 1);
  assert.equal(r.descartadas.length, 1);
  assert.equal(r.novas.length, 0);
});

test('descartes factuais preservam os três valores negativos sem notas semânticas', () => {
  const casos = [
    [11110001, 'modalidade_incompativel', { modeloCompativel: false }, { modelo: 'hibrido' }],
    [11110002, 'inscricoes_encerradas', { aberta: false }, { encerrada: true }],
    [11110003, 'pais_incompativel', { paisCompativel: false }, { pais: 'EUA' }],
    [11110004, 'nivel_excluido', {}, { titulo: 'Junior Product Designer' }],
  ];
  const observacoes = casos.map(([id, criterio, revisao, vaga]) => base(id, {
    titulo: vaga.titulo || 'Senior Product Designer',
    vagaRevisada: { ...base(id).vagaRevisada, ...vaga, semantico: undefined },
    revisao: { ...revisao },
    desfecho: desfecho(`captura-${id}`, 'descartada', criterio),
  }));
  const r = prepararLote({ observacoes });
  assert.equal(r.descartadas.length, 4, JSON.stringify(r.pendencias));
  assert.equal(r.novas.length, 0);
  assert.equal(r.pendencias.length, 0);
  assert.equal(observacoes[0].revisao.modeloCompativel, false);
  assert.equal(observacoes[1].revisao.aberta, false);
  assert.equal(observacoes[2].revisao.paisCompativel, false);
});

test('decisão de rodada e pistas comprovadas preservam alcance e próxima ação', () => {
  const obs = [base(11110005, { revisao: {}, desfecho: desfecho('captura-11110005',
    'descartada', 'decisao_rodada', { alcance: 'rodada', decisaoPor: 'pessoa', fonte: 'fixture:decisão-da-pessoa' }) }),
  base(11110006, { urlCandidatura: 'https://ats-nao-suportada.test/jobs/6',
    desfecho: pista('captura-11110006', 'ats_sem_suporte') }),
  base(11110007, { desfecho: pista('captura-11110007', 'identidade_nao_comprovada') }),
  base(11110008, { desfecho: pista('captura-11110008', 'conflito_factual') }),
  base(11110009, { urlCandidatura: null, desfecho: pista('captura-11110009', 'fonte_inacessivel') })];
  const r = prepararLote({ observacoes: obs });
  assert.equal(r.descartadas.length, 1);
  assert.equal(r.descartadas[0].desfecho.alcance, 'rodada');
  assert.equal(r.pistas.length, 4, JSON.stringify(r));
  assert.equal(r.novas.length, 0);
  assert.equal(r.pendencias.length, 0);
});

test('escopo manual exige regra vigente e revisão negativa sem alterar o filtro', () => {
  const caso = base(11110016, { titulo: 'User Interface Designer',
    revisao: { escopoCompativel: false },
    desfecho: desfecho('captura-11110016', 'descartada', 'escopo_incompativel',
      { regraRef: 'fixture:orientação-de-área-vigente', evidencia: 'Descrição concentra websites e marketing' }) });
  assert.equal(prepararLote({ observacoes: [caso] }).descartadas.length, 1);
  assert.equal(prepararLote({ observacoes: [{ ...caso, desfecho: { ...caso.desfecho, regraRef: '' } }] }).pendencias.length, 1);
});

test('rótulo, prova incompleta, critério contraditório e observação repetida mantêm pendência', () => {
  const r = prepararLote({ observacoes: [
    base(11110010, { revisao: {}, desfecho: { tipo: 'pista', motivo: 'pendente' } }),
    base(11110011, { revisao: { modeloCompativel: true },
      desfecho: desfecho('captura-11110011', 'descartada', 'modalidade_incompativel') }),
    base(11110012, { desfecho: pista('captura-11110012', 'conflito_factual', { proximaAcao: '' }) }),
    base(11110013, { desfecho: pista('id-inexistente', 'conflito_factual') }),
    base(11110014), base(11110014),
  ] });
  assert.equal(r.pendencias.length, 5, JSON.stringify(r));
  assert.equal(r.novas.length, 1);
  assert.equal(r.pistas.length, 0);
  assert.equal(r.descartadas.length, 0);
});

test('identidade forte conhecida prevalece sobre novo descarte e alias solto não funde', () => {
  const conhecida = base(11110015, { revisao: { aberta: false },
    desfecho: desfecho('captura-11110015', 'descartada', 'inscricoes_encerradas') });
  const r = prepararLote({ observacoes: [conhecida],
    cache: { vagas: { 'linkedin:11110015': { idExterno: 'linkedin:11110015',
      link: 'https://www.linkedin.com/jobs/view/11110015' } } },
    estado: { vagas: { 'linkedin:11110015': { status: 'Aplicado por IA',
      url: 'https://www.linkedin.com/jobs/view/11110015' } } } });
  assert.equal(r.duplicatas.length, 1);
  assert.equal(r.descartadas.length, 0);
  assert.equal(r.duplicatas[0].motivo, 'ja concluida no quadro');
});

test('CTA sem extrator conserva destino e reconhece apenas ID original exato no quadro', () => {
  const cta = 'https://ats.exemplo.test/vagas/designer-123';
  const conhecida = base(12121212, { postOriginal: 'https://www.linkedin.com/jobs/view/12121212/',
    urlCandidatura: cta });
  const outra = base(13131313, { postOriginal: 'https://www.linkedin.com/jobs/view/13131313/',
    urlCandidatura: cta });
  const estado = { vagas: { 'linkedin:12121212': { status: 'Aplicado por IA',
    url: 'https://www.linkedin.com/jobs/view/12121212/', titulo: conhecida.titulo,
    empresa: conhecida.empresa } } };
  const r = prepararLote({ observacoes: [conhecida, outra], estado });
  assert.equal(r.duplicatas.length, 1);
  assert.equal(r.duplicatas[0].idObservacao, conhecida.chave);
  assert.equal(r.duplicatas[0].motivo, 'ja concluida no quadro');
  assert.equal(r.pendencias.length, 1);
  assert.equal(r.pendencias[0].idObservacao, outra.chave);
  assert.equal(r.novas.length, 0);
  assert.equal(r.descartadas.length, 0);
  assert.equal(conhecida.urlCandidatura, cta);
});

test('descarte factual com fonte do ID original supera conflito fraco sem unir identidades', () => {
  const conflito = { vagas: { 'linkedin:14141414': { status: 'Cancelada',
    url: 'https://www.linkedin.com/jobs/view/14141414/', titulo: 'UX Designer Intern',
    empresa: 'Empresa Exemplo' },
  'linkedin:15151515': { status: 'Cancelada',
    url: 'https://www.linkedin.com/jobs/view/15151515/', titulo: 'Senior Product Designer',
    empresa: 'Empresa Exemplo' } } };
  const hibrida = base(16161616, { postOriginal: 'https://www.linkedin.com/jobs/view/16161616/',
    revisao: { modeloCompativel: false }, vagaRevisada: { modelo: 'hibrido' },
    desfecho: desfecho('captura-16161616', 'descartada', 'modalidade_incompativel',
      { evidencia: 'Modelo Hybrid no anúncio', fonte: 'fixture/linkedin-16161616.json' }) });
  const intern = base(17171717, { titulo: 'UX Designer Intern',
    postOriginal: 'https://www.linkedin.com/jobs/view/17171717/',
    desfecho: desfecho('captura-17171717', 'descartada', 'nivel_excluido',
      { evidencia: 'UX Designer Intern', fonte: 'https://www.linkedin.com/jobs/view/17171717/' }) });
  const fonteErrada = { ...hibrida, chave: 'captura-fonte-errada',
    desfecho: { ...hibrida.desfecho, idObservacao: 'captura-fonte-errada',
      fonte: 'https://fonte.exemplo/jobs/view/99999999?ref=16161616' } };
  const notaErrada = { ...hibrida, chave: 'captura-nota-errada',
    desfecho: { ...hibrida.desfecho, idObservacao: 'captura-nota-errada',
      fonte: 'fixture/outro-anuncio.json; nota: 16161616' } };
  const arquivoErrado = { ...hibrida, chave: 'captura-arquivo-errado',
    desfecho: { ...hibrida.desfecho, idObservacao: 'captura-arquivo-errado',
      fonte: 'fixture/linkedin-99999999.json?ref=16161616' } };
  const semFonte = { ...intern, chave: 'captura-sem-fonte',
    desfecho: { ...intern.desfecho, idObservacao: 'captura-sem-fonte', fonte: '' } };
  const r = prepararLote({ observacoes: [hibrida, intern, fonteErrada, notaErrada,
    arquivoErrado, semFonte], estado: conflito });
  assert.deepEqual(r.descartadas.map((x) => x.idObservacao), [hibrida.chave, intern.chave]);
  assert.deepEqual(r.pendencias.map((x) => x.idObservacao), [fonteErrada.chave,
    notaErrada.chave, arquivoErrado.chave, semFonte.chave]);
  assert.equal(r.duplicatas.length, 0);
  assert.equal(r.novas.length, 0);
  assert.equal(Object.keys(conflito.vagas).length, 2);
});

test('CTA sem extrator só usa vínculo com prova, ponta igual e ID histórico exato', () => {
  const cta = 'https://ats.exemplo.test/vagas/mesma-requisicao';
  const historico = 'https://www.linkedin.com/jobs/view/19191919/';
  const vinculo = { urlA: cta, urlB: historico, evidencia: 'Mesmo identificador de requisição nas duas capturas.' };
  const conhecida = base(18181818, { postOriginal: 'https://www.linkedin.com/jobs/view/18181818/',
    urlCandidatura: cta, vinculos: [vinculo] });
  const semProva = base(20202020, { postOriginal: 'https://www.linkedin.com/jobs/view/20202020/',
    urlCandidatura: cta, vinculos: [{ ...vinculo, evidencia: '' }] });
  const pontaErrada = base(21212121, { postOriginal: 'https://www.linkedin.com/jobs/view/21212121/',
    urlCandidatura: cta, vinculos: [{ ...vinculo, urlA: 'https://ats.exemplo.test/outra' }] });
  const idAusente = base(22222222, { postOriginal: 'https://www.linkedin.com/jobs/view/22222222/',
    urlCandidatura: cta, vinculos: [{ ...vinculo, urlB: 'https://www.linkedin.com/jobs/view/23232323/' }] });
  const estado = { vagas: { 'linkedin:19191919': { status: 'Cancelada', url: historico } } };
  const r = prepararLote({ observacoes: [conhecida, semProva, pontaErrada, idAusente], estado });
  assert.deepEqual(r.duplicatas.map((x) => x.idObservacao), [conhecida.chave]);
  assert.equal(r.duplicatas[0].existente, 'linkedin:19191919');
  assert.deepEqual(r.pendencias.map((x) => x.idObservacao),
    [semProva.chave, pontaErrada.chave, idAusente.chave]);
  assert.equal(r.novas.length, 0);
  assert.equal(r.pistas.length, 0);
  assert.equal(conhecida.urlCandidatura, cta);
});

test('descarte Intern com CTA sem extrator usa filtro real e cede ao histórico exato', () => {
  const obs = base(24242424, { titulo: 'Product Design Intern', empresa: 'Empresa Exemplo',
    postOriginal: 'https://www.linkedin.com/jobs/view/24242424/',
    urlCandidatura: 'https://grnh.se/identidade-nao-extraivel',
    vagaRevisada: { titulo: 'Product Design Intern', empresa: 'Empresa Exemplo' },
    revisao: {}, desfecho: desfecho('captura-24242424', 'descartada', 'nivel_excluido',
      { evidencia: 'Product Design Intern', fonte: 'https://www.linkedin.com/jobs/view/24242424/' }) });
  const descartada = prepararLote({ observacoes: [obs] });
  assert.equal(descartada.descartadas.length, 1, JSON.stringify(descartada.pendencias));
  assert.equal(descartada.novas.length, 0);
  const estado = { vagas: { 'linkedin:24242424': { status: 'Aplicado por IA',
    url: obs.postOriginal } } };
  const conhecida = prepararLote({ observacoes: [obs], estado });
  assert.equal(conhecida.duplicatas.length, 1);
  assert.equal(conhecida.descartadas.length, 0);
  const semFonte = prepararLote({ observacoes: [{ ...obs,
    desfecho: { ...obs.desfecho, fonte: 'https://www.linkedin.com/jobs/view/99999999/?ref=24242424' } }] });
  assert.equal(semFonte.pendencias.length, 1);
  assert.equal(semFonte.descartadas.length, 0);
});

test('repeticao por LinkedIn e ATS une proveniencia dos dois posts', () => {
  const observacoes = [base(88888888), base(88888888, {
    chave: 'segunda-captura', postOriginal: 'https://www.linkedin.com/posts/outro_9',
    urlResolvida: 'https://jobs.smartrecruiters.com/EmpresaExemplo/743999000000088-designer',
    evidenciaResolucao: 'Redirecionamento observado',
  })];
  const r = prepararLote({ observacoes });
  assert.equal(r.novas.length, 1);
  assert.equal(r.duplicatas.length, 1);
  assert.equal(r.novas[0].origemFeed.length, 2);
  assert.equal(r.novas[0].fonte, 'SmartRecruiters');
  assert.ok(r.novas[0].idsAlternativos.includes('linkedin:88888888'));
});

test('link curto so e usado quando resolvido com evidencia', () => {
  const curta = base(99999999, { urlCandidatura: 'https://exemplo.test/atalho/9',
    urlResolvida: 'https://www.linkedin.com/jobs/view/99999999' });
  const semEvidencia = prepararLote({ observacoes: [curta] });
  assert.equal(semEvidencia.novas.length, 0);
  assert.equal(semEvidencia.pendencias.length, 1);
  const comEvidencia = prepararLote({ observacoes: [{ ...curta, evidenciaResolucao: 'Destino conferido' }] });
  assert.equal(comEvidencia.novas[0].idExterno, 'linkedin:99999999');
});

test('ID social sem prova de vinculo nao funde ATS e revisao sem eixos nao publica', () => {
  const a = base(10101010, { urlCandidatura: 'https://jobs.smartrecruiters.com/EmpresaExemplo/743999000000101-designer',
    idsAlternativos: ['linkedin:20202020'] });
  const r = prepararLote({ observacoes: [a] });
  assert.equal(r.novas.length, 1);
  assert.ok(!r.novas[0].idsAlternativos.includes('linkedin:20202020'));
  const incompleta = prepararLote({ observacoes: [base(30303030, {
    revisao: { aberta: true, canal: 'link', paisCompativel: true, modeloCompativel: true },
  })] });
  assert.equal(incompleta.novas.length, 0);
  assert.equal(incompleta.pendencias.length, 1);
});

test('alias ATS solto nao colapsa duas requisicoes diferentes', () => {
  const a = base(40404040, { urlCandidatura: 'https://jobs.smartrecruiters.com/EmpresaExemplo/743999000000011-designer',
    idsAlternativos: ['smartrecruiters:743999000000012'],
    linksAlternativos: ['https://jobs.smartrecruiters.com/EmpresaExemplo/743999000000012-designer'],
    evidenciaVinculo: 'texto sem par de URLs' });
  const b = base(50505050, { urlCandidatura: 'https://jobs.smartrecruiters.com/EmpresaExemplo/743999000000012-designer' });
  const r = prepararLote({ observacoes: [a, b] });
  assert.equal(r.novas.length, 1);
  assert.equal(r.pendencias.length, 1, 'empresa e cargo iguais exigem conferencia, sem colapsar por alias');
  assert.equal(r.duplicatas.length, 0);
  assert.ok(!r.novas[0].idsAlternativos.includes('smartrecruiters:743999000000012'));
});

test('mesmo ID e URL prevalecem sobre numeros conflitantes no titulo', () => {
  const url = 'https://jobs.smartrecruiters.com/EmpresaExemplo/743999000000011-designer';
  const r = prepararLote({ observacoes: [
    base(80808080, { titulo: '(1234) Senior Product Designer', urlCandidatura: url }),
    base(90909090, { titulo: '(5678) Senior Product Designer', urlCandidatura: `${url}?utm_source=feed` }),
  ] });
  assert.equal(r.novas.length, 1);
  assert.equal(r.duplicatas.length, 1);
  assert.equal(r.novas[0].idExterno, 'smartrecruiters:743999000000011');
});

test('eixo fora de 0 a 10 ou sem fonte e justificativa impede publicacao', () => {
  const umEixo40 = base(60606060, { vagaRevisada: { ...base(1).vagaRevisada, semantico: 40 },
    revisao: { ...base(1).revisao, eixos: [{ nota: 40, evidencia: 'Trecho', fonte: 'Anuncio', justificativa: 'Texto' },
      { nota: 0, evidencia: 'Trecho', fonte: 'Anuncio', justificativa: 'Texto' },
      { nota: 0, evidencia: 'Trecho', fonte: 'Anuncio', justificativa: 'Texto' },
      { nota: 0, evidencia: 'Trecho', fonte: 'Anuncio', justificativa: 'Texto' }] } });
  const semFonte = base(70707070, { revisao: { ...base(1).revisao,
    eixos: [{ nota: 5, evidencia: 'Trecho', justificativa: 'Texto' },
      ...base(1).revisao.eixos.slice(1)] } });
  const r = prepararLote({ observacoes: [umEixo40, semFonte] });
  assert.equal(r.novas.length, 0);
  assert.equal(r.pendencias.length, 2);
});
