#!/usr/bin/env node
// Planeja o despacho nativo sem adquirir posse, abrir navegador ou iniciar rede.
import { join } from 'node:path';
import { DIR_DADOS } from '../src/config.js';
import { lerJsonSeguro } from '../src/persistencia.js';
import { planejarFrentes } from '../src/coordenacao-frentes.js';

try {
  const args = process.argv.slice(2);
  const capacidade = args.length === 2 && args[0] === '--capacidade' ? Number(args[1]) : 4;
  if (args.length && !(args.length === 2 && args[0] === '--capacidade')) throw new Error('USO: coordenar-frentes.mjs [--capacidade 1..4]');
  const politica = lerJsonSeguro(join(DIR_DADOS, 'politica-autonomia.json'), { modoCandidatura: 'mapear' });
  const plano = planejarFrentes({ frentes: politica.frentes, modoCandidatura: politica.modoCandidatura, capacidade });
  console.log(JSON.stringify({ ...plano, somentePlanejamento: true, procedimento: 'vagas/COORDENACAO-FRENTES.md' }, null, 2));
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
}
