import test from 'node:test';
import assert from 'node:assert/strict';
import { viaIntermediario } from '../src/intermediario.js';

test('classificação mantém somente o sinal conhecido de contratante escondida', () => {
  for (const empresa of ['Jobgether', 'JOBGETHER (empresa não revelada)', 'Empresa nao revelada']) assert.equal(viaIntermediario(empresa), true);
  for (const empresa of [null, '', 'Acme Consultoria', 'Acme Staffing', 'Acme Recruiting', 'Acme Consultancy', 'Acme Talent Agency']) assert.equal(viaIntermediario(empresa), false);
});
