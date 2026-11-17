import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atualizarHistorico, marcarIntermediarias, parecidasJaAplicadas, avisarReaparecimento } from '../src/historico.js';

const vaga = (over) => ({ idExterno: 'x', empresa: 'Truelogic', titulo: 'Senior Product Designer', fonte: 'Built In', ...over });

test('historico guarda o primeiro dia, atualiza o ultimo, e nunca apaga', () => {
  let h = atualizarHistorico({ versao: 1, vagas: {} }, [vaga({ idExterno: 'a' })], '2026-09-01');
  h = atualizarHistorico(h, [vaga({ idExterno: 'b' })], '2026-09-23');
  h = atualizarHistorico(h, [vaga({ idExterno: 'a' })], '2026-09-23');
  assert.equal(h.vagas.a.primeiraVez, '2026-09-01');
  assert.equal(h.vagas.a.ultimaVez, '2026-09-23');
  assert.deepEqual(h.vagas.a.dias, ['2026-09-01', '2026-09-23']);
  assert.ok(h.vagas.b, 'b continua mesmo sem aparecer de novo');
});

test('historico vazio ou quebrado comeca do zero sem perder a rodada', () => {
  const h = atualizarHistorico(null, [vaga({ idExterno: 'a' })], '2026-09-23');
  assert.equal(h.vagas.a.primeiraVez, '2026-09-23');
});

test('mesmo dia duas vezes nao duplica o dia', () => {
  let h = atualizarHistorico(null, [vaga({ idExterno: 'a' })], '2026-09-23');
  h = atualizarHistorico(h, [vaga({ idExterno: 'a' })], '2026-09-23');
  assert.deepEqual(h.vagas.a.dias, ['2026-09-23']);
});

test('vaga de intermediario com empresa escondida sai marcada, a direta nao', () => {
  const [a, b, c] = marcarIntermediarias([
    vaga({ empresa: 'Jobgether (empresa não revelada)' }),
    vaga({ empresa: 'Jobgether' }),
    vaga({ empresa: 'Avenue' }),
  ]);
  assert.equal(a.intermediario, true);
  assert.equal(b.intermediario, true);
  assert.equal(c.intermediario, false);
});

test('parecidas ja aplicadas: cargo parecido primeiro, e so o que foi aplicado', () => {
  const quadro = {
    'gupy:1': { status: 'Aplicado por IA', empresa: 'Asaas', titulo: 'Senior Product Designer' },
    'gupy:2': { status: 'Já apliquei', empresa: 'Nomad', titulo: 'Product Designer Pleno' },
    'gupy:3': { status: 'Avaliar', empresa: 'Stone', titulo: 'Senior Product Designer' },
    'gupy:4': { status: 'Aplicado por IA', empresa: 'Deel', titulo: 'Content Designer' },
  };
  const r = parecidasJaAplicadas({ titulo: 'Senior Product Designer - Remote' }, quadro);
  assert.equal(r[0].idExterno, 'gupy:1');
  assert.ok(!r.some((x) => x.idExterno === 'gupy:3'), 'vaga nao aplicada fica fora');
  assert.ok(!r.some((x) => x.idExterno === 'gupy:4'), 'cargo sem palavra em comum fica fora');
});


test('reaparecimento avisa aos 90 dias, preserva gaps e não altera nota', () => {
  const h = atualizarHistorico({ versao: 1, extra: true, vagas: { antiga: { empresa: 'Empresa Exemplo', titulo: 'Product Designer', primeiraVez: '2026-01-01', ultimaVez: '2026-01-01', dias: ['2026-01-01'], fonte: 'Fonte anterior', extra: 7 } } }, [vaga({ idExterno: 'nova', empresa: 'Empresa Exemplo', titulo: 'Product Designer' })], '2026-04-01');
  const v = vaga({ idExterno: 'nova', empresa: 'Empresa Exemplo', titulo: 'Product Designer', gaps: ['Lacuna anterior'], compatibilidade: 81 });
  const antes = JSON.stringify(h); avisarReaparecimento([v], h, '2026-04-01'); avisarReaparecimento([v], h, '2026-04-01');
  assert.equal(v.gaps.length, 2); assert.match(v.gaps[1], /90 dias.*2026-01-01.*2026-04-01.*historico.json/);
  assert.equal(v.compatibilidade, 81); assert.equal(JSON.stringify(h), antes); assert.equal(h.vagas.antiga.extra, 7); assert.equal(h.vagas.antiga.fonte, 'Fonte anterior'); assert.equal(h.extra, true);
});

test('89 dias, cidades no mesmo dia, desconhecidos e intermediários não geram aviso', () => {
  for (const empresa of ['Empresa Exemplo', 'Desconhecida', 'Não informada', 'Jobgether', 'Empresa confidencial']) {
    const h = atualizarHistorico(null, [vaga({ idExterno: 'a', empresa, localizacao: 'São Paulo' }), vaga({ idExterno: 'b', empresa, localizacao: 'Rio de Janeiro' })], '2026-01-01');
    const v = vaga({ empresa, gaps: [] }); avisarReaparecimento([v], h, '2026-03-31'); assert.deepEqual(v.gaps, []);
    if (empresa !== 'Empresa Exemplo') { atualizarHistorico(h, [v], '2026-04-01'); avisarReaparecimento([v], h, '2026-04-01'); assert.deepEqual(v.gaps, []); }
  }
});

test('datas inválidas ou futuras e cargos/empresas distintos não inventam intervalo', () => {
  for (const data of ['2026-02-30', 'não é data', '2027-01-01']) {
    const h = { vagas: { antiga: { empresa: 'Truelogic', titulo: 'Senior Product Designer', primeiraVez: data, ultimaVez: '2026-04-01' } } };
    const v = vaga({ gaps: [] }); avisarReaparecimento([v], h, '2026-04-01'); assert.deepEqual(v.gaps, []);
  }
  const h = atualizarHistorico(null, [vaga({ empresa: 'Outra empresa', titulo: 'Product Designer' })], '2026-01-01');
  atualizarHistorico(h, [vaga({ idExterno: 'nova' })], '2026-04-01');
  const v = vaga({ gaps: [] }); avisarReaparecimento([v], h, '2026-04-01'); assert.deepEqual(v.gaps, []);
});


test('intervalo real de 89 dias fica sem alerta e gaps textuais são preservados', () => {
  const h = atualizarHistorico(null, [vaga()], '2026-01-01'); atualizarHistorico(h, [vaga()], '2026-03-31');
  const v = vaga({ gaps: 'Lacuna textual', compatibilidade: 77 }); avisarReaparecimento([v], h, '2026-03-31'); assert.equal(v.gaps, 'Lacuna textual');
  atualizarHistorico(h, [v], '2026-04-01'); avisarReaparecimento([v], h, '2026-04-01'); assert.equal(v.gaps[0], 'Lacuna textual'); assert.equal(v.gaps.length, 2);
  atualizarHistorico(h, [v], '2026-04-02'); avisarReaparecimento([v], h, '2026-04-02'); assert.equal(v.gaps.length, 2); assert.match(v.gaps[1], /91 dias/); assert.equal(v.compatibilidade, 77);
});


test('atualização não apaga última data inválida ou futura para fabricar alerta', () => {
  for (const ultimaVez of ['2026-02-30', '2027-01-01']) {
    const h = { vagas: { x: { empresa: 'Truelogic', titulo: 'Senior Product Designer', primeiraVez: '2026-01-01', ultimaVez, dias: ['2026-01-01'], fonte: 'Original' } } };
    const v = vaga({ gaps: [] }); atualizarHistorico(h, [v], '2026-04-01'); avisarReaparecimento([v], h, '2026-04-01');
    assert.equal(h.vagas.x.ultimaVez, ultimaVez); assert.deepEqual(v.gaps, []); assert.equal(h.vagas.x.fonte, 'Original');
  }
});


test('nome de consultoria não presume intermediário sem classificação factual', () => {
  for (const empresa of ['Acme Consultoria', 'Acme Consultancy', 'Acme Recruiting', 'Acme Staffing', 'Acme Talent Agency']) {
    const v = vaga({ empresa, gaps: [] });
    const h = atualizarHistorico(null, [v], '2026-01-01'); atualizarHistorico(h, [v], '2026-04-01');
    avisarReaparecimento([v], h, '2026-04-01'); assert.equal(v.gaps.length, 1, empresa);
    const classificada = { ...v, intermediario: true, gaps: [] };
    avisarReaparecimento([classificada], h, '2026-04-01'); assert.deepEqual(classificada.gaps, []);
  }
});
