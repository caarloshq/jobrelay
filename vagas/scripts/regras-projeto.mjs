import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { iniciarRegras, registrarRegra } from '../src/regras-projeto.js';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [acao = 'ler', arquivo] = process.argv.slice(2);
if (acao === 'ler') console.log(JSON.stringify(iniciarRegras(raiz, process.env.VAGAS_DIR_DADOS || path.join(raiz, 'vagas/data'))));
else if (acao === 'registrar' && arquivo) console.log(JSON.stringify(registrarRegra(raiz, JSON.parse(fs.readFileSync(arquivo, 'utf8')), process.env.VAGAS_DIR_DADOS || path.join(raiz, 'vagas/data'))));
else throw new Error('Use regras [ler | registrar arquivo.json]. O JSON é uma proposta transitória, nunca outro banco.');
