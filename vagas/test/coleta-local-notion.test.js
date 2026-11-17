import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

test('entrada principal coleta offline no modo Notion sem snapshot e preserva terminal conhecido', async t => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const fixture = fs.mkdtempSync(path.join(root, 'vagas/test/coleta-notion-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const dados = path.join(fixture, 'dados'); fs.mkdirSync(dados);
  const salvar = (nome, objeto) => fs.writeFileSync(path.join(dados, nome), JSON.stringify(objeto));
  const hoje = new Date().toISOString().slice(0, 10);
  const antiga = new Date(Date.parse(hoje + 'T00:00:00Z') - 90 * 86400000).toISOString().slice(0, 10);
  salvar('historico.json', { versao: 1, preservado: true, vagas: { antiga: { empresa: 'Empresa Fictícia', titulo: 'Product Designer Sênior', primeiraVez: antiga, ultimaVez: antiga, dias: [antiga], fonte: 'Fonte anterior', preservado: 7 } } });
  salvar('fonte-estado.json', { fonte: 'notion', databaseId: 'database-ficticia' });
  const historico = [{ em: '2026-11-01T12:00:00.000Z', de: 'Avaliar', para: 'Aplicado por IA', por: 'fixture' }];
  salvar('quadro.json', { versao: 2, vagas: { 'gupy:recebida': { status: 'Aplicado por IA', titulo: 'Recebida', url: 'https://example.invalid/oferta?job_id=recebida', historico } } });
  // Recibo só da instalação fictícia, usando o helper já empregado pelo teste de upgrade.
  const { criarSessaoFormulario } = await import('../src/onboarding-humano.js');
  const formulario = criarSessaoFormulario(dados);
  for (let n = 1; n <= 7; n++) formulario.registrarPasso(n);
  formulario.confirmar(true);
  const loader = path.join(fixture, 'loader.mjs');
  fs.writeFileSync(loader, `export async function load(url, context, next) {
    if (url.endsWith('/src/fontes-registro.js')) return { format:'module', shortCircuit:true, source: \`export function criarFontes() { return [{ NOME:'Fixture offline', coletar:async()=>({vagas:['nova','recebida','fora'].map(id=>({idExterno:'gupy:'+id, fonte:'Gupy', titulo:id==='fora'?'Cargo fora da área':'Product Designer Sênior', empresa:'Empresa Fictícia', link:'https://example.invalid/oferta?job_id='+id, descricao:'Produto fictício', remota:true, publicadaEm:new Date().toISOString()})), contador:{fonte:'Fixture',brutas:3,consultadas:1,falhas:0}}) }]; }\` };
    if (url.endsWith('/src/fontes/apify.js')) return {format:'module',shortCircuit:true,source:"export const NOME='Apify'; export const modo=()=> 'desligado'; export const coletar=()=>{throw Error('APIFY_PROIBIDA_NO_TESTE')};"};
    if (url.endsWith('/src/versao-git.js')) return {format:'module',shortCircuit:true,source:"export const verificarVersaoGit=async()=>({estado:'fixture'}); export const formatarVersaoGit=()=> 'Fixture offline';"};
    if (url.endsWith('/src/filtro.js')) return {format:'module',shortCircuit:true,source:"export const avaliar=(vaga)=>vaga.idExterno==='gupy:fora'?{passa:false,motivo:'titulo fora da area'}:{passa:true};"};
    if (url.endsWith('/src/mercado.js')) return {format:'module',shortCircuit:true,source:"export const fontesAtivas=(fontes)=>fontes; export const descontoMercado=()=>0;"};
    if (url.endsWith('/src/liveness.js')) return {format:'module',shortCircuit:true,source:"export const validar=async()=>({validada:true});"};
    const loaded=await next(url,context);
    if (url.endsWith('/src/config.js')) return {...loaded,source:loaded.source.toString().replace(\"export const perfil = ler('perfil.json');\",\"export const perfil = { ...ler('perfil.json'), _configurado:true };\")};
    return loaded;
  }`);
  const entrada = pathToFileURL(path.join(root, 'vagas/src/coletar.js')).href;
  const r = spawnSync(process.execPath, ['--experimental-loader', loader, '--input-type=module', '-e', `globalThis.fetch=()=>{throw Error('REDE_PROIBIDA_NO_TESTE')};process.argv.push('--sem-ddg');await import(${JSON.stringify(entrada)});`], {
    cwd: root, encoding: 'utf8', timeout: 15000, env: { ...process.env, VAGAS_DIR_DADOS:dados, VAGAS_SEM_ENV:'1', APIFY_TOKEN:'', APIFY_TASK:'' },
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const quadro = JSON.parse(fs.readFileSync(path.join(dados, 'quadro.json')));
  assert.equal(quadro.vagas['gupy:nova'].status, 'Avaliar');
  assert.equal(quadro.vagas['gupy:nova'].pendenteNotion, true);
  assert.equal(quadro.vagas['gupy:recebida'].status, 'Aplicado por IA');
  assert.deepEqual(quadro.vagas['gupy:recebida'].historico, historico);
  const fila = JSON.parse(fs.readFileSync(path.join(dados, 'fila-notion.json')));
  assert.deepEqual(Object.keys(fila.itens), ['gupy:nova']);
  assert.equal(fs.existsSync(path.join(dados, 'notion.json')), false);
  const arqRodada = fs.readdirSync(dados).find(n => /^rodada-\d{4}-\d{2}-\d{2}\.json$/.test(n));
  const rodada = JSON.parse(fs.readFileSync(path.join(dados, arqRodada)));
  assert.deepEqual(rodada.titulosDescartadosForaDaArea, { 'Cargo fora da área': 1 });
  assert.equal(rodada.reaparecimentos.length >= 1, true);
  assert.match(rodada.reaparecimentos[0].aviso, /90 dias.*historico.json/);
  const memoria = JSON.parse(fs.readFileSync(path.join(dados, 'historico.json')));
  assert.equal(memoria.preservado, true); assert.equal(memoria.vagas.antiga.preservado, 7); assert.equal(memoria.vagas.antiga.fonte, 'Fonte anterior');
  assert.deepEqual(memoria.vagas.antiga.dias, [antiga]); assert.equal(memoria.vagas['gupy:nova'].ultimaVez, hoje);
  const cache = JSON.parse(fs.readFileSync(path.join(dados, 'vagas.json')));
  assert.equal(cache.vagas['gupy:nova'].gaps.some(g => /90 dias/.test(g)), true);
  assert.equal(quadro.vagas['gupy:nova'].gaps.some(g => /90 dias/.test(g)), true);
  assert.equal(rodada.sincronizacaoNotion.destinoConfirmado, false);
  assert.equal(rodada.sincronizacaoNotion.pendentes, 1);
  assert.equal(rodada.sincronizacaoNotion.referencia, 'data/fila-notion.json');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dados, 'fonte-estado.json'))).fonte, 'notion');
});
