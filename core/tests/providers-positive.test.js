// Fixtures mínimas e FICTÍCIAS; não são capturas nem prova de suporte live.
// Estruturas: career-ops MIT, commit 2f7a0d7bd68409c8b26d0c09d2b2b73b13ee524a,
// tests/providers/{a16z-speedrun-talent,builtin,gem,generalist-world,hackernews,jobvite,join,personio,wttj}.test.mjs.
// Copyright upstream: Santiago Fernández de Valderrama; licença preservada em
// src/fontes/careerops/LICENSE. Casos adaptados para node:test, sem anúncios reais.
// Corroboração primária: https://speedrun-talent-network.com/api/v1/openapi.json
// https://developer.personio.de/docs/retrieving-open-job-positions
// https://api.gem.com/job_board/v0/reference — https://join.com/companies/join
// https://builtin.com/jobs/dev-engineering — https://generalist.world/jobs/
// Capturas e hashes reais não integram esta fixture pública; ficam na auditoria privada.
// JOIN: HTML público observado tem pageData.jobs.items; upstream antigo usava initialState.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const provider = async nome => (await import(`../src/fontes/careerops/providers/${nome}.mjs`)).default;
const originalFetch = globalThis.fetch;
test.before(() => { globalThis.fetch = async () => { throw Error('REDE_PROIBIDA_NESTA_SUITE'); }; });
test.after(() => { globalThis.fetch = originalFetch; });
const titulo = 'Product Designer';
const empresa = 'Empresa Exemplo';
const data = '2026-01-02T12:00:00.000Z';
const htmlJoin = (envelope, itens, paginas = 1) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { [envelope]: { company: { domain: 'empresa-exemplo' }, jobs: { items: itens, pagination: { pageCount: paginas } } } } } })}</script>`;
const jobJoin = id => ({ idParam: id, title: titulo, city: { cityName: 'Remote - Global' } });
async function lerJoin(envelope) {
 const p = await provider('join');
 const chamadas=[];
 const jobs=await p.fetch({ name: empresa, careers_url: 'https://join.com/companies/empresa-exemplo' }, { fetchText:async (url, opcoes)=>{chamadas.push([url,opcoes]);return htmlJoin(envelope,[jobJoin('101'),jobJoin('102')]);} });
 assert.equal(chamadas.length,1);assert.equal(chamadas[0][1].redirect,'error');return jobs;
}
test('JOIN positivo: pageData real como estrutura, sem copiar anúncios',async()=>{
 const jobs=await lerJoin('pageData');assert.equal(jobs.length,2);assert.equal(jobs[0].company,empresa);assert.equal(jobs[0].title,titulo);assert.equal(jobs[0].url,'https://join.com/companies/empresa-exemplo/jobs/101');
});
test('JOIN legado continua com URLs idênticas e lê pageData nas páginas seguintes',async()=>{
 const antigo=await lerJoin('initialState'),novo=await lerJoin('pageData');assert.deepEqual(novo,antigo);
 const p=await provider('join');const urls=[];const jobs=await p.fetch({name:empresa,careers_url:'https://join.com/companies/empresa-exemplo'},{fetchText:async url=>{urls.push(url);return urls.length===1?htmlJoin('initialState',[jobJoin('101')],2):htmlJoin('pageData',[jobJoin('102')],2);}});
 assert.deepEqual(urls,['https://join.com/companies/empresa-exemplo','https://join.com/companies/empresa-exemplo?page=2']);assert.equal(jobs.length,2);
});
test('JOIN recusa estrutura inválida e preserva o limite de páginas do contexto',async()=>{
 const p=await provider('join');await assert.rejects(()=>p.fetch({name:empresa,careers_url:'https://join.com/companies/empresa-exemplo'},{fetchText:async()=>'<script id="__NEXT_DATA__">{"props":{"pageProps":{"pageData":{"jobs":{"items":{}}}}}}</script>'}),/unexpected structure/);
 let chamadas=0;const jobs=await p.fetch({name:empresa,careers_url:'https://join.com/companies/empresa-exemplo'},{maxPages:1,fetchText:async()=>{chamadas++;return htmlJoin('pageData',[jobJoin('101')],3);}});assert.equal(chamadas,1);assert.equal(jobs.length,1);
});
test('JOIN: os dois envelopes mantêm IDs do adaptador e dedupe forte, sem ler perfil real',async t=>{
 const antigo=await lerJoin('initialState'),novo=await lerJoin('pageData');
 const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'provider-join-offline-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const loader=path.join(dir,'config-ficticia.mjs');fs.writeFileSync(loader,`export async function load(url,context,next){if(url.endsWith('/src/config.js'))return {format:'module',shortCircuit:true,source:"export const palavras={titulo_aceito:{'product designer':20}};"};return next(url,context);}`);
 const adaptador=new URL('../src/fontes/gringas.js',import.meta.url).href;const dedupe=new URL('../src/dedupe.js',import.meta.url).href;
 const codigo=`import {paraVaga} from ${JSON.stringify(adaptador)};import {juntar} from ${JSON.stringify(dedupe)};let s='';for await(const parte of process.stdin)s+=parte;const [a,b]=JSON.parse(s).map(itens=>itens.map(j=>paraVaga(j,{name:'JOIN'},'join')));if([...a,...b].some(v=>!v))throw Error('FIXTURE_REJEITADA');console.log(JSON.stringify({idsAntigos:a.map(v=>v.idExterno),idsNovos:b.map(v=>v.idExterno),total:juntar([...a,...b],{identidadeEstrita:true}).vagas.length}));`;
 const r=spawnSync(process.execPath,['--experimental-loader',loader,'--input-type=module','-e',codigo],{input:JSON.stringify([antigo,novo]),encoding:'utf8',env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR,VAGAS_SEM_ENV:'1'}});assert.equal(r.status,0,r.stderr);const prova=JSON.parse(r.stdout);assert.deepEqual(prova.idsNovos,prova.idsAntigos);assert.equal(new Set(prova.idsNovos).size,2);assert.equal(prova.total,2);
});
test('a16z positivo documentado: envelope e paginação de 50 itens preservam campos',async()=>{
 const p=await provider('a16z-speedrun-talent');const chamadas=[];
 const mk=i=>({id:String(i),title:titulo,company:empresa,url:`https://speedrun-talent-network.com/jobs/fixture-${i}`,location:'Brazil',remote:true,published_at:data});
 const jobs=await p.fetch({name:'Board fictício',max_pages:2},{fetchJson:async(url,opcoes)=>{chamadas.push(url);assert.equal(opcoes.redirect,'error');const pagina=Number(new URL(url).searchParams.get('page'));return {jobs:pagina===0?Array.from({length:50},(_,i)=>mk(i)):[mk(50)],page:pagina,page_size:50,total:51,total_pages:2};}});
 assert.equal(chamadas.length,2);assert.equal(jobs.length,51);assert.equal(jobs[0].title,titulo);assert.equal(jobs[0].company,empresa);assert.match(jobs[0].location,/Brazil/);assert.match(jobs[0].location,/Remote/);assert.equal(jobs[0].postedAt,Date.parse(data));
});
test('Built In positivo fictício: ItemList e card correlacionam empregador e modalidade',async()=>{
 const p=await provider('builtin');const url='https://builtin.com/job/product-designer/101';
 const spine=JSON.stringify({'@type':'ItemList',itemListElement:[{'@type':'ListItem',position:1,name:titulo,url,description:'Descrição fictícia.'}]});
 const html=`<script type="application/ld+json">${spine}</script><div><a href="/company/empresa-exemplo"><span>${empresa}</span></a></div><h2><a href="/job/product-designer/101" data-id="job-card-title" data-builtin-track-job-id="101">${titulo}</a></h2><div><i class="fa-regular fa-clock"></i>Yesterday</span></div><div><i class="fa-regular fa-house-building"></i><span>Remote</span></div><div><i class="fa-regular fa-location-dot"></i><span>Brazil</span></div>`;
 const jobs=await p.fetch({builtin:{queries:['product designer'],max_pages:1}},{fetchText:async solicitado=>{assert.match(solicitado,/^https:\/\/builtin\.com\//);return html;}});
 assert.equal(jobs.length,1);assert.equal(jobs[0].title,titulo);assert.equal(jobs[0].company,empresa);assert.equal(jobs[0].url,url);assert.match(jobs[0].location,/Brazil/);assert.match(jobs[0].location,/Remote/);
});
test('Gem REST positivo: forma oficial sem GraphQL nem credenciais',async()=>{
 const p=await provider('gem');const api='https://api.gem.com/job_board/v0/empresa-exemplo/job_posts/';
 const jobs=await p.fetch({name:empresa,api},{fetchJson:async(url,opcoes)=>{assert.equal(url,api);assert.equal(opcoes.redirect,'error');return [{id:'101',title:titulo,absolute_url:'https://jobs.gem.com/empresa-exemplo/101',location:{name:'Brazil',isRemote:true},first_published_at:data,content_plain:'Descrição fictícia.'}];}});
 assert.equal(jobs.length,1);assert.equal(jobs[0].company,empresa);assert.equal(jobs[0].title,titulo);assert.equal(jobs[0].postedAt,Date.parse(data));assert.match(jobs[0].location,/Remote/);assert.equal(jobs[0].description,'Descrição fictícia.');
});
test('Generalist World positivo: card fictício em container documentado',async()=>{
 const p=await provider('generalist-world');const html=`<section data-jobs-container><a class="gw-job-card" data-type="connector" data-region="remote" href="/jobs/product-designer-fixture/"><div class="gw-job-company">${empresa}</div><div class="gw-job-title">${titulo}</div><p class="gw-job-description">Descrição fictícia.</p><span class="gw-job-meta-tag gw-location">Remote (Global)</span></a></section>`;
 const jobs=await p.fetch({provider:'generalist-world'},{fetchText:async url=>{assert.equal(url,'https://generalist.world/jobs/');return html;}});assert.equal(jobs.length,1);assert.equal(jobs[0].title,titulo);assert.equal(jobs[0].company,empresa);assert.equal(jobs[0].url,'https://generalist.world/jobs/product-designer-fixture/');assert.match(jobs[0].location,/Remote/);
});
test('HackerNews positivo: descoberta e comentários fictícios preservam ausência de empregador',async()=>{
 const p=await provider('hackernews');const urls=[];
 const jobs=await p.fetch({name:'HN Board'},{fetchJson:async(url,opcoes)=>{urls.push(url);assert.equal(opcoes.redirect,'error');return urls.length===1?{hits:[{objectID:'1001',title:'Ask HN: Who is hiring? (November 2026)'}]}:{children:[{text:`${empresa} | ${titulo} | Remote Global | https://example.invalid/jobs/101`,created_at:data},{text:'Equipe buscando pessoas para produto.',created_at:data},{text:'Deletado',deleted:true},{text:'Morto',dead:true}]};}});
 assert.equal(urls.length,2);assert.equal(urls[1],'https://hn.algolia.com/api/v1/items/1001');assert.equal(jobs.length,2);assert.equal(jobs[0].company,empresa);assert.match(jobs[0].title,/Product Designer/);assert.equal(jobs[0].postedAt,Date.parse(data));assert.equal(jobs[1].company,null);
});
test('Jobvite positivo: XML fictício distingue detail e apply sem executar candidatura',async()=>{
 const p=await provider('jobvite');const api='https://app.jobvite.com/CompanyJobs/Xml.aspx?c=fixtureEid';const html=`<result><job><id>fixture1</id><title>Product Designer &amp; Research</title><location>Brazil</location><date>11/17/2026</date><detail-url><![CDATA[http://app.jobvite.com/CompanyJobs/Job.aspx?c=fixtureEid&j=fixture1]]></detail-url><apply-url><![CDATA[https://app.jobvite.com/CompanyJobs/Careers.aspx?c=fixtureEid&j=fixture1&k=Apply]]></apply-url></job></result>`;
 const jobs=await p.fetch({name:empresa,api},{fetchText:async(url,opcoes)=>{assert.equal(url,api);assert.equal(opcoes.redirect,'manual');return html;}});assert.equal(jobs.length,1);assert.equal(jobs[0].title,'Product Designer & Research');assert.equal(jobs[0].company,empresa);assert.equal(jobs[0].location,'Brazil');assert.match(jobs[0].url,/^https:/);assert.match(jobs[0].url,/Job\.aspx/);assert.equal(Number.isFinite(jobs[0].postedAt),true);
});
test('Personio positivo: estrutura XML oficial com conteúdo e tenant fictícios',async()=>{
 const p=await provider('personio');const html=`<workzag-jobs><position><id>101</id><name><![CDATA[${titulo}]]></name><office>Brazil</office><additionalOffices><office>Remote</office></additionalOffices><createdAt>${data}</createdAt><jobDescriptions><jobDescription><name>Outra seção</name><value>Conteúdo fictício.</value></jobDescription></jobDescriptions></position></workzag-jobs>`;
 const jobs=await p.fetch({name:empresa,careers_url:'https://empresa-exemplo.jobs.personio.de/'},{fetchText:async(url,opcoes)=>{assert.equal(url,'https://empresa-exemplo.jobs.personio.de/xml');assert.equal(opcoes.redirect,'error');return html;}});assert.equal(jobs.length,1);assert.equal(jobs[0].title,titulo);assert.equal(jobs[0].company,empresa);assert.equal(jobs[0].url,'https://empresa-exemplo.jobs.personio.de/job/101');assert.equal(jobs[0].location,'Brazil, Remote');assert.equal(jobs[0].postedAt,Date.parse(data));
});
test('WTTJ positivo: env/Algolia fictícios deduplicam hit entre consultas estreitas',async()=>{
 const p=await provider('wttj');const consultas=[];const hit={name:titulo,slug:'designer-fixture',organization:{name:empresa,slug:'empresa-exemplo'},offices:[{city:'São Paulo',country:'Brazil'}],remote:'fulltime',published_at_timestamp:Date.parse(data)/1000};
 const jobs=await p.fetch({wttj:{queries:['product designer','ux designer']}},{fetchText:async url=>{assert.equal(url,'https://www.welcometothejungle.com/api/env');return 'window.env = {"PUBLIC_ALGOLIA_APPLICATION_ID":"AB12CD34","PUBLIC_ALGOLIA_API_KEY_CLIENT":"0000000000000000"};';},fetchJson:async(url,opcoes)=>{assert.equal(url,'https://AB12CD34-dsn.algolia.net/1/indexes/wttj_jobs_production_en/query');assert.equal(opcoes.method,'POST');assert.equal(opcoes.headers['x-algolia-api-key'],'0000000000000000');consultas.push(new URLSearchParams(JSON.parse(opcoes.body).params).get('query'));return {hits:[hit]};}});
 assert.deepEqual(consultas,['product designer','ux designer']);assert.equal(jobs.length,1);assert.equal(jobs[0].company,empresa);assert.equal(jobs[0].title,titulo);assert.match(jobs[0].location,/Remote/);assert.equal(jobs[0].postedAt,Date.parse(data));
});
