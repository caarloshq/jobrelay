import {test} from 'node:test';import assert from 'node:assert/strict';
import {evidenciaModalidade,fundirModalidade} from '../src/modalidade.js';
test('false e linguagem de clientes não inventam modalidade',()=>{
 const v=evidenciaModalidade({fonte:'QA',remoto:false,titulo:'Software Engineer',descricao:'Atuação com clientes presenciais e equipes híbridas.'});
 assert.equal(v.modelo,null);assert.equal(v.remoto,null);assert.deepEqual(v.modalidadeEvidencias,[]);
});
test('declaração explícita vence acervo remoto preservando conflito',()=>{
 const v=evidenciaModalidade({fonte:'QA',modelo:'remoto',remoto:true,titulo:'Software Engineer',descricao:'Modalidade: Presencial em Curitiba.'});
 assert.equal(v.modelo,'presencial');assert.equal(v.conflitoModalidade,true);assert.deepEqual(new Set(v.modalidadeEvidencias.map(e=>e.modelo)),new Set(['remoto','presencial']));
});
test('fusão conserva origem e local nas duas ordens',()=>{
 const a={fonte:'API A',modelo:null,remoto:null};const b={fonte:'API B',modelo:'hibrido',cidade:'Curitiba'};
 for(const v of [fundirModalidade(a,b),fundirModalidade(b,a)]){assert.equal(v.modelo,'hibrido');assert.equal(v.cidade,'Curitiba');assert.ok(v.modalidadeEvidencias.some(e=>e.origem==='API B'&&e.modelo==='hibrido'));assert.ok(v.localizacaoEvidencias.some(e=>e.valor==='Curitiba'));}
});
