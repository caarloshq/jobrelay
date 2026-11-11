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

test('observacao simples e DM ficam fora da fila', () => {
  const r = prepararLote({ observacoes: [
    { titulo: 'Senior Product Designer', empresa: 'A', urlCandidatura: 'https://www.linkedin.com/jobs/view/11111111' },
    { titulo: 'Senior Product Designer', empresa: 'B', postOriginal: 'https://www.linkedin.com/posts/b_1', canal: 'DM' },
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
    base(66666666, { urlCandidatura: 'https://www.linkedin.com/posts/exemplo_66666666' }),
    base(77777777, { titulo: 'Junior Product Designer' }),
  ] });
  assert.equal(r.pistas.length, 1);
  assert.equal(r.descartadas.length, 1);
  assert.equal(r.novas.length, 0);
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
