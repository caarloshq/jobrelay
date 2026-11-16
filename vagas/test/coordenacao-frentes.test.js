import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planejarFrentes,CoordenadorFrentes,executarFrentes,PERGUNTA_COLETA2} from '../src/coordenacao-frentes.js';
const op={frentes:['coleta','aplicacao'],modoCandidatura:'chrome_assistido',capacidade:4};
const recibo={localConfirmado:true,destinoConfirmado:true,arquivosOrganizados:true,provaRef:'fixture:releitura-local-e-destino'};
const sim={decisao:'sim',provaRef:'fixture:aceite-da-pessoa'};
const nao={decisao:'nao',provaRef:'fixture:recusa-da-pessoa'};
test('seleção isolada e mapear não iniciam outra frente',()=>{
 assert.deepEqual(planejarFrentes({frentes:['aplicacao']}).ativas,[]);
 assert.deepEqual(planejarFrentes({...op,frentes:['aplicacao']}).ativas,['aplicacao']);
 assert.equal(planejarFrentes(op).paralelo,false);
});
test('ordem da rodada: coleta principal antes da aplicação, e a coleta 2 só existe com a frente de coleta',()=>{
 assert.deepEqual(planejarFrentes(op).ordem,['coleta','aplicacao']);
 assert.equal(planejarFrentes(op).priorizaRetomadas,true);
 assert.equal(planejarFrentes(op).coleta2.pergunta,'Quer continuar com a coleta 2 (LinkedIn assistido)?');
 assert.equal(PERGUNTA_COLETA2,'Quer continuar com a coleta 2 (LinkedIn assistido)?');
 assert.equal(planejarFrentes({...op,frentes:['aplicacao']}).coleta2,null);
 assert.equal(planejarFrentes({...op,frentes:['coleta']}).coleta2.exigeAceite,true);
 assert.throws(()=>planejarFrentes({...op,origem:'robo'}),/ORIGEM_INVALIDA/);
});
test('ciclo completo: coleta, aplicação, pergunta, coleta 2, pergunta de aplicar, aplicação das novas',async()=>{
 const eventos=[];
 const r=await executarFrentes(op,{
  coletar:async c=>{eventos.push(c.etapa);return recibo;},
  aplicar:async c=>{assert.equal(c.somenteFilaConfirmada,true);assert.equal(c.coletaEncerrada(),true);eventos.push(c.etapa);},
  perguntarColeta2:async c=>{eventos.push(c.etapa);return sim;},
  coletar2:async c=>{eventos.push(c.etapa);return {...recibo,novasCompativeis:2};},
  perguntarAplicarNovas:async (c,n)=>{assert.equal(n,2);eventos.push(c.etapa);return sim;},
  aplicarNovasColeta2:async c=>{eventos.push(c.etapa);},
 });
 assert.deepEqual(eventos,['coleta','retomadas_e_novas_confirmadas','pergunta_coleta2','coleta2','pergunta_aplicar_novas','novas_da_coleta2']);
 assert.ok(r.resultados.every(x=>x.status==='fulfilled'));
 assert.deepEqual(r.coleta2,{estado:'encerrada',aceiteRef:sim.provaRef});
});
test('não aplicar agora: as vagas da coleta 2 ficam para a próxima rodada',async()=>{
 const eventos=[];
 const r=await executarFrentes(op,{coletar:async()=>recibo,aplicar:async()=>{eventos.push('aplicar');},perguntarColeta2:async()=>sim,coletar2:async()=>({...recibo,novasCompativeis:3}),
  perguntarAplicarNovas:async()=>nao,aplicarNovasColeta2:async()=>{eventos.push('novas');}});
 assert.deepEqual(eventos,['aplicar']);
 assert.equal(r.coleta2.novasAdiadas,true);
});
test('sem resposta, resposta não ou sim sem prova: a coleta 2 nunca roda',async()=>{
 for(const [perguntar,esperado] of [[undefined,'sem_resposta'],[async()=>nao,'recusada'],[async()=>({decisao:'sim'}),'sem_resposta'],[async()=>({decisao:'sim',provaRef:' '}),'sem_resposta'],[async()=>null,'sem_resposta'],[async()=>{throw new Error('x');},'sem_resposta'],[async()=>'sim','sem_resposta']]){
  let rodou=false;
  const r=await executarFrentes(op,{coletar:async()=>recibo,aplicar:async()=>{},perguntarColeta2:perguntar,coletar2:async()=>{rodou=true;return recibo;}});
  assert.equal(rodou,false);assert.equal(r.coleta2.estado,esperado);
  assert.ok(!r.resultados.some(x=>x.frente==='coleta2'));
 }
});
test('rodada agendada nem pergunta: sem resposta, registrada',async()=>{
 let perguntou=false,rodou=false;
 const r=await executarFrentes({...op,origem:'agendada'},{coletar:async()=>recibo,aplicar:async()=>{},perguntarColeta2:async()=>{perguntou=true;return sim;},coletar2:async()=>{rodou=true;return recibo;}});
 assert.equal(perguntou,false);assert.equal(rodou,false);assert.deepEqual(r.coleta2,{estado:'sem_resposta',motivo:'sem_resposta'});
});
test('coleta 2 sem vaga nova gravada não faz a segunda pergunta',async()=>{
 for(const novas of [0,undefined,-1,1.5,'2']){
  let perguntou=false;
  await executarFrentes(op,{coletar:async()=>recibo,aplicar:async()=>{},perguntarColeta2:async()=>sim,coletar2:async()=>({...recibo,novasCompativeis:novas}),
   perguntarAplicarNovas:async()=>{perguntou=true;return sim;},aplicarNovasColeta2:async()=>{}});
  assert.equal(perguntou,false);
 }
});
test('callback de dispensa que lança não derruba a rodada',async()=>{
 const r=await executarFrentes(op,{coletar:async()=>recibo,aplicar:async()=>{},coleta2Dispensada:()=>{throw new Error('x');},perguntarColeta2:async()=>nao,coletar2:async()=>recibo});
 assert.equal(r.coleta2.estado,'recusada');
});
test('LinkedIn desligado ou janela feita: dispensada antes de qualquer pergunta, mesmo na agendada',async()=>{
 for(const origem of ['manual','agendada']){
  let perguntou=false;
  const r=await executarFrentes({...op,origem},{coletar:async()=>recibo,aplicar:async()=>{},coleta2Dispensada:()=>'linkedin_desligado',perguntarColeta2:async()=>{perguntou=true;return sim;},coletar2:async()=>recibo});
  assert.equal(perguntou,false);assert.deepEqual(r.coleta2,{estado:'dispensada',motivo:'linkedin_desligado'});
 }
});
test('sem aplicação (só coleta, ou modo mapear): a pergunta vem logo depois da coleta e não há segunda pergunta',async()=>{
 for(const opcoes of [{...op,frentes:['coleta']},{...op,modoCandidatura:'mapear'}]){
  const eventos=[];let perguntouAplicar=false;
  const r=await executarFrentes(opcoes,{coletar:async c=>{eventos.push(c.etapa);return recibo;},perguntarColeta2:async c=>{eventos.push(c.etapa);return sim;},coletar2:async c=>{eventos.push(c.etapa);return recibo;},
   perguntarAplicarNovas:async()=>{perguntouAplicar=true;return sim;},aplicarNovasColeta2:async()=>{}});
  assert.deepEqual(eventos,['coleta','pergunta_coleta2','coleta2']);assert.equal(perguntouAplicar,false);assert.equal(r.coleta2.estado,'encerrada');
 }
});
test('aplicação isolada não tem coleta 2',async()=>{
 const r=await executarFrentes({...op,frentes:['aplicacao']},{aplicar:async()=>{}});
 assert.equal(r.coleta2,null);assert.equal(r.plano.coleta2,null);
});
test('aplicação que não terminou (impedimento) ou coleta principal que falhou: a pergunta não é feita, a fila confirmada segue',async()=>{
 let perguntou=false;const perguntar=async()=>{perguntou=true;return sim;};
 const a=await executarFrentes(op,{coletar:async()=>recibo,aplicar:async()=>{throw new Error('fixture:aguardando-pessoa');},perguntarColeta2:perguntar,coletar2:async()=>recibo});
 assert.equal(a.coleta2.motivo,'aplicacao_nao_concluida');assert.equal(perguntou,false);
 for(const retorno of [undefined,{...recibo,destinoConfirmado:false},{...recibo,arquivosOrganizados:false}]){
  const etapas=[];
  const r=await executarFrentes(op,{coletar:async()=>retorno,aplicar:async c=>{etapas.push(c.etapa);assert.equal(c.coletaEncerrada(),false);assert.ok(c.erroColeta());},perguntarColeta2:perguntar,coletar2:async()=>recibo});
  assert.deepEqual(etapas,['retomadas_e_novas_confirmadas']);
  assert.equal(r.resultados.find(x=>x.frente==='coleta').status,'rejected');
  assert.equal(r.coleta2.motivo,'coleta_principal_nao_encerrada');assert.equal(perguntou,false);
 }
});
test('coleta 2 que falha fica impedida e não aplica nada',async()=>{
 let aplicouNovas=false;
 const r=await executarFrentes(op,{coletar:async()=>recibo,aplicar:async()=>{},perguntarColeta2:async()=>sim,coletar2:async()=>{throw new Error('fixture:login');},
  perguntarAplicarNovas:async()=>sim,aplicarNovasColeta2:async()=>{aplicouNovas=true;}});
 assert.equal(r.coleta2.estado,'impedida');assert.equal(aplicouNovas,false);
 assert.equal(r.resultados.find(x=>x.frente==='coleta2').status,'rejected');
});
test('impedimento de uma retomada não derruba a rodada: a coleta principal já fechou e o resultado fica registrado',async()=>{
 const eventos=[];
 const r=await executarFrentes(op,{coletar:async c=>{eventos.push(c.etapa);return recibo;},aplicar:async c=>{eventos.push(c.etapa);throw new Error('fixture:aguardando-pessoa');},coletar2:async()=>recibo});
 assert.deepEqual(eventos,['coleta','retomadas_e_novas_confirmadas']);
 assert.equal(r.resultados[1].status,'rejected');
});
test('executor ausente falha antes de iniciar callbacks, inclusive o da coleta 2',async()=>{
 let iniciou=false;await assert.rejects(executarFrentes(op,{coletar:()=>{iniciou=true;}}),/EXECUTOR_AUSENTE/);assert.equal(iniciou,false);
 await assert.rejects(executarFrentes(op,{coletar:()=>{iniciou=true;},aplicar:()=>{}}),/EXECUTOR_AUSENTE:coleta2/);assert.equal(iniciou,false);
});
test('retomada não exige coleta encerrada, mas navegador continua exigindo posse',async()=>{
 const c=new CoordenadorFrentes(op);await c.executar('aplicacao',()=>true);
 assert.equal(c.coletaPronta,false);
 await assert.rejects(c.comNavegador({frente:'aplicacao',posseConfirmada:false,checkpointRef:'fixture'},()=>{}),/NAVEGADOR_SEM_POSSE/);
 await c.comNavegador({frente:'aplicacao',posseConfirmada:true,checkpointRef:'fixture'},()=>true);
 assert.equal(c.coletaPronta,false);c.concluirColeta(recibo);assert.equal(c.coletaPronta,true);
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
test('fronteira recusa auxiliares ativos e nova coleta principal após fechamento', async()=>{
 const c=new CoordenadorFrentes(op);let liberar;const tarefa=c.executar('coleta',()=>new Promise(r=>liberar=r));
 assert.throws(()=>c.concluirColeta(recibo),/COLETA_AINDA_ATIVA/);liberar();await tarefa;c.concluirColeta(recibo);
 await assert.rejects(c.executar('coleta',()=>{}),/COLETA_JA_ENCERRADA/);
});
test('a coleta 2 roda depois que a principal fechou, com navegador e fechamento próprios',async()=>{
 const c=new CoordenadorFrentes(op);
 await assert.rejects(c.executar('coleta2',()=>{}),/COLETA_PRINCIPAL_ABERTA/);
 await assert.rejects(c.comNavegador({frente:'coleta2',posseConfirmada:true,checkpointRef:'fixture'},()=>{}),/COLETA_PRINCIPAL_ABERTA/);
 assert.throws(()=>c.concluirColeta2(recibo),/COLETA_PRINCIPAL_ABERTA/);
 assert.throws(()=>c.autorizarColeta2('fixture:aceite'),/COLETA_PRINCIPAL_ABERTA/);
 c.concluirColeta(recibo);
 await assert.rejects(c.executar('coleta2',()=>true),/COLETA2_SEM_ACEITE/);
 await assert.rejects(c.comNavegador({frente:'coleta2',posseConfirmada:true,checkpointRef:'fixture'},()=>{}),/COLETA2_SEM_ACEITE/);
 assert.throws(()=>c.autorizarColeta2(' '),/ACEITE_COLETA2_OBRIGATORIO/);
 c.autorizarColeta2('fixture:aceite');
 await assert.rejects(c.comNavegador({frente:'coleta2',posseConfirmada:false,checkpointRef:'fixture'},()=>{}),/NAVEGADOR_SEM_POSSE/);
 assert.equal(await c.comNavegador({frente:'coleta2',posseConfirmada:true,checkpointRef:'fixture'},()=>true),true);
 assert.equal(await c.executar('coleta2',()=>true),true);
 assert.throws(()=>c.concluirColeta2({...recibo,destinoConfirmado:false}),/FECHAMENTO_COLETA2_OBRIGATORIO/);
 c.concluirColeta2(recibo);
 await assert.rejects(c.executar('coleta2',()=>{}),/COLETA2_JA_ENCERRADA/);
 await assert.rejects(c.executar('coleta',()=>{}),/COLETA_JA_ENCERRADA/);
});
test('sem frente de coleta não existe coleta 2',async()=>{
 const c=new CoordenadorFrentes({...op,frentes:['aplicacao']});
 await assert.rejects(c.executar('coleta2',()=>{}),/FRENTE_DESABILITADA/);
});
test('reserva de navegador da coleta impede fechamento, incluindo espera na fila',async()=>{
 const c=new CoordenadorFrentes(op);let liberar;const acesso={frente:'coleta',posseConfirmada:true,checkpointRef:'fixture'};
 const a=c.comNavegador(acesso,()=>new Promise(r=>liberar=r));const b=c.comNavegador(acesso,async()=>true);
 await Promise.resolve();assert.throws(()=>c.concluirColeta(recibo),/COLETA_AINDA_ATIVA/);liberar();await Promise.all([a,b]);c.concluirColeta(recibo);
});
test('falha falsy continua rejeitada e não libera coleta',async()=>{
 for(const falha of [null,false,undefined]){const c=new CoordenadorFrentes(op);let sucesso=false;await c.executar('coleta',()=>Promise.reject(falha)).then(()=>sucesso=true,()=>{});assert.equal(sucesso,false);assert.equal(c.coletaPronta,false);}
});
