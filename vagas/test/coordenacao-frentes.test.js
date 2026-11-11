import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planejarFrentes,CoordenadorFrentes,executarFrentes} from '../src/coordenacao-frentes.js';
const op={frentes:['coleta','aplicacao'],modoCandidatura:'chrome_assistido',capacidade:4};
const recibo={localConfirmado:true,destinoConfirmado:true,arquivosOrganizados:true,provaRef:'fixture:releitura-local-e-destino'};
test('seleção isolada e mapear não iniciam outra frente',()=>{
 assert.deepEqual(planejarFrentes({frentes:['aplicacao']}).ativas,[]);
 assert.deepEqual(planejarFrentes({...op,frentes:['aplicacao']}).ativas,['aplicacao']);
 assert.equal(planejarFrentes(op).paralelo,false);
});
test('aplica somente após coleta salva, conferida, organizada',async()=>{
 const eventos=[];
 const r=await executarFrentes(op,{coletar:async()=>{eventos.push('coletar','salvar','conferir','organizar');return recibo;},aplicar:async c=>{assert.equal(c.coletaEncerrada(),true);eventos.push('aplicar');}});
 assert.deepEqual(eventos,['coletar','salvar','conferir','organizar','aplicar']);assert.ok(r.resultados.every(x=>x.status==='fulfilled'));
});
test('falha ou recibo incompleto da coleta bloqueia aplicação, preservando rascunhos',async()=>{
 for(const retorno of [undefined,{...recibo,destinoConfirmado:false},{...recibo,arquivosOrganizados:false}]){
  let aplicou=false;const r=await executarFrentes(op,{coletar:async()=>retorno,aplicar:async()=>{aplicou=true;}});assert.equal(aplicou,false);assert.equal(r.resultados.at(-1).status,'rejected');
 }
});
test('não pula fase por chamar executor/navegador diretamente',async()=>{
 const c=new CoordenadorFrentes(op);await assert.rejects(c.executar('aplicacao',()=>{}),/COLETA_NAO_CONFERIDA/);
 await assert.rejects(c.comNavegador({frente:'aplicacao',posseConfirmada:true,checkpointRef:'fixture'},()=>{}),/COLETA_NAO_CONFERIDA/);
 c.concluirColeta(recibo);await c.executar('aplicacao',()=>{});
});
test('duas posições na frente e capacidade global menor limitam auxiliares',async()=>{
 for(const capacidade of [1,2,3,4]){
  const c=new CoordenadorFrentes({...op,frentes:['coleta'],capacidade});let n=0,max=0;
  await Promise.all([1,2,3,4].map(()=>c.executar('coleta',async()=>{n++;max=Math.max(n,max);await new Promise(r=>setTimeout(r,2));n--;})));
  assert.equal(max,Math.min(2,capacidade));
 }
});
test('navegador compartilhado serializa e libera após falha',async()=>{
 const c=new CoordenadorFrentes({...op,frentes:['aplicacao']});let n=0;const acesso={frente:'aplicacao',posseConfirmada:true,checkpointRef:'fixture'};
 const a=c.comNavegador(acesso,async()=>{n++;assert.equal(n,1);n--;throw new Error('simulada');});const b=c.comNavegador(acesso,async()=>{n++;assert.equal(n,1);n--;return true;});assert.equal((await Promise.allSettled([a,b]))[1].value,true);
});
test('executor ausente falha antes de iniciar callbacks',async()=>{
 let iniciou=false;await assert.rejects(executarFrentes(op,{coletar:()=>{iniciou=true;}}),/EXECUTOR_AUSENTE/);assert.equal(iniciou,false);
});

test('fronteira recusa auxiliares ativos e nova coleta após fechamento', async()=>{
 const c=new CoordenadorFrentes(op);let liberar;const tarefa=c.executar('coleta',()=>new Promise(r=>liberar=r));
 assert.throws(()=>c.concluirColeta(recibo),/COLETA_AINDA_ATIVA/);liberar();await tarefa;c.concluirColeta(recibo);
 await assert.rejects(c.executar('coleta',()=>{}),/COLETA_JA_ENCERRADA/);
});

test('reserva de navegador da coleta impede fechamento, incluindo espera na fila',async()=>{
 const c=new CoordenadorFrentes(op);let liberar;const acesso={frente:'coleta',posseConfirmada:true,checkpointRef:'fixture'};
 const a=c.comNavegador(acesso,()=>new Promise(r=>liberar=r));const b=c.comNavegador(acesso,async()=>true);
 await Promise.resolve();assert.throws(()=>c.concluirColeta(recibo),/COLETA_AINDA_ATIVA/);liberar();await Promise.all([a,b]);c.concluirColeta(recibo);
});
test('falha falsy continua rejeitada e não libera coleta',async()=>{
 for(const falha of [null,false,undefined]){const c=new CoordenadorFrentes(op);let sucesso=false;await c.executar('coleta',()=>Promise.reject(falha)).then(()=>sucesso=true,()=>{});assert.equal(sucesso,false);assert.equal(c.coletaPronta,false);}
});
