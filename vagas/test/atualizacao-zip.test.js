const REPO_PUBLICO = 'https://github.com/caarloshq/jobrelay';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { atualizarAutomaticamente, podeIniciarOperacao, lerConfirmacao } from '../src/atualizacao.js';
import { lerZip } from '../src/atualizacao-zip.js';
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/testes-atualizacao-zip');
fs.mkdirSync(base, { recursive: true });
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
function fixture(t, extras = {}) {
  const raiz = fs.mkdtempSync(path.join(base, 'caso-'));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  fs.mkdirSync(path.join(raiz, 'vagas/data'), { recursive: true }); fs.mkdirSync(path.join(raiz, 'vagas/src'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'vagas/package.json'), JSON.stringify({ name: 'jobrelay', version: '1.4.0' }));
  fs.writeFileSync(path.join(raiz, 'vagas/src/atualizacao.js'), 'original');
  const arquivos = { 'jobrelay/vagas/package.json': JSON.stringify({ name: 'jobrelay', version: '1.5.0' }), 'jobrelay/vagas/src/atualizacao.js': 'novo', 'jobrelay/vagas/src/novo.js': 'novo módulo', ...extras };
  const zip = path.join(raiz, 'vagas/data/fixture.zip');
  execFileSync('python3', ['-c', 'import json,sys,zipfile\na=json.loads(sys.argv[2])\nwith zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED) as z:\n for n,v in a.items(): z.writestr(n,v)', zip, JSON.stringify(arquivos)]);
  const bytes = fs.readFileSync(zip);
  const release = { tag: 'v1.5.0', tagSha: 'a'.repeat(40), assetSha256: hash(bytes), assetUrl: `${REPO_PUBLICO}/releases/download/v1.5.0/jobrelay.zip` };
  let downloads = 0;
  const opcoes = { raiz, consultarRelease: async () => release, fetchImpl: async url => { downloads++; return { ok: true, status: 200, url, headers: new Headers(), body: new Blob([bytes]).stream() }; } };
  const aceite = { aceita: true, tag: release.tag, tagSha: release.tagSha, assetSha256: release.assetSha256 };
  return { raiz, bytes, release, opcoes, aceite, downloads: () => downloads };
}

test('ZIP só baixa após aceite e preserva dados, configuração, regras e histórico', async t => {
  const f = fixture(t, { 'jobrelay/vagas/config/perfil.json': 'exemplo', 'jobrelay/REGRAS-DO-PROJETO.md': 'exemplo', 'jobrelay/REGRAS-DO-PROJETO.md.bak': 'exemplo', 'jobrelay/aplicacao/RESPOSTAS.md': 'exemplo' });
  const pessoais = { 'vagas/config/perfil.json': 'privado', 'REGRAS-DO-PROJETO.md': 'minhas regras', 'REGRAS-DO-PROJETO.md.bak': 'regras anteriores', 'aplicacao/RESPOSTAS.md': 'minhas respostas', 'vagas/data/historico.json': 'meu histórico' };
  for (const [n,v] of Object.entries(pessoais)) { fs.mkdirSync(path.dirname(path.join(f.raiz,n)), { recursive: true }); fs.writeFileSync(path.join(f.raiz,n),v); }
  const pendente = await atualizarAutomaticamente(f.opcoes); assert.equal(pendente.status,'aguardando_confirmacao'); assert.equal(f.downloads(),0); assert.equal(podeIniciarOperacao(pendente),false);
  const r = await atualizarAutomaticamente({ ...f.opcoes, confirmacao: f.aceite });
  assert.equal(r.status,'atualizado', JSON.stringify(r)); assert.equal(f.downloads(),1);
  assert.equal(fs.readFileSync(path.join(f.raiz,'vagas/src/atualizacao.js'),'utf8'),'novo');
  for (const [n,v] of Object.entries(pessoais)) assert.equal(fs.readFileSync(path.join(f.raiz,n),'utf8'),v,n);
  assert.equal(fs.readFileSync(path.join(f.raiz,r.backup,'arquivos/vagas/src/atualizacao.js'),'utf8'),'original');
  assert.equal((await atualizarAutomaticamente(f.opcoes)).status,'sem_atualizacao'); assert.equal(f.downloads(),1);
});

test('hash divergente e asset não canônico falham sem tocar código', async t => {
  const f=fixture(t); f.release.assetSha256='b'.repeat(64); f.aceite.assetSha256=f.release.assetSha256;
  assert.equal((await atualizarAutomaticamente({ ...f.opcoes, confirmacao:f.aceite })).motivo,'ASSET_HASH_DIVERGENTE');
  f.release.assetUrl='https://evil.invalid/jobrelay.zip';
  assert.equal((await atualizarAutomaticamente({ ...f.opcoes, confirmacao:f.aceite })).motivo,'ASSET_NAO_VERIFICAVEL');
  assert.equal(fs.readFileSync(path.join(f.raiz,'vagas/src/atualizacao.js'),'utf8'),'original');
});

test('ZIP reverte os arquivos já trocados quando uma gravação falha', async t => {
  const f=fixture(t); let gravacoes=0;
  const r=await atualizarAutomaticamente({ ...f.opcoes,confirmacao:f.aceite, antesGravarZip: () => { if (++gravacoes===3) throw new Error('falha sintética'); } });
  assert.equal(r.status,'bloqueado');
  assert.equal(fs.readFileSync(path.join(f.raiz,'vagas/src/atualizacao.js'),'utf8'),'original');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.raiz,'vagas/package.json'))).version,'1.4.0');
  assert.equal(fs.existsSync(path.join(f.raiz,'vagas/src/novo.js')),false);
  assert.equal(fs.existsSync(path.join(f.raiz,'vagas/data/operacao/.atualizacao.lock')),false);
});

test('ZIP bloqueia destinos simbólicos, hardlinks e operação ativa antes de instalar', async t => {
  for (const tipo of ['symlink','hardlink','operacao']) {
    const f=fixture(t); const app=path.join(f.raiz,'vagas/src/atualizacao.js');
    if (tipo==='symlink') { fs.unlinkSync(app); fs.symlinkSync('../data/fixture.zip',app); }
    if (tipo==='hardlink') fs.linkSync(app,path.join(f.raiz,'vagas/data/hardlink'));
    if (tipo==='operacao') { fs.mkdirSync(path.join(f.raiz,'vagas/data/operacao')); fs.writeFileSync(path.join(f.raiz,'vagas/data/operacao/estado.json'),JSON.stringify({contrato:1,status:'ativa'})); }
    const r=await atualizarAutomaticamente({ ...f.opcoes, confirmacao:f.aceite });
    assert.equal(r.status,'bloqueado'); assert.equal(r.motivo, tipo==='symlink'?'CAMINHO_SIMBOLICO':tipo==='hardlink'?'DESTINO_INSEGURO':'OPERACAO_OCUPADA');
    if(tipo==='operacao')assert.equal(f.downloads(),0);
  }
});

test('ZIP rejeita traversal, duplicata por caixa e pacote sem identidade', async t => {
  for (const extras of [{ 'jobrelay/../fora':'x' }, { 'jobrelay/VAGAS/src/NOVO.js':'x' }, { 'jobrelay/vagas/package.json':'{}' }]) {
    const f=fixture(t,extras); const r=await atualizarAutomaticamente({ ...f.opcoes, confirmacao:f.aceite });
    assert.equal(r.status,'bloqueado'); assert.equal(fs.readFileSync(path.join(f.raiz,'vagas/src/atualizacao.js'),'utf8'),'original');
  }
  assert.throws(()=>lerZip(Buffer.from('não é zip')));
});

test('ZIP recusa mudança de dependências e downgrade, sem instalar', async t => {
  const f=fixture(t, { 'jobrelay/vagas/package.json': JSON.stringify({ name:'jobrelay',version:'1.5.0',dependencies:{ 'pacote':'1.0.0' } }) });
  assert.equal((await atualizarAutomaticamente({ ...f.opcoes,confirmacao:f.aceite })).motivo,'ZIP_DEPENDENCIAS_ALTERADAS');
  f.release.tag='v1.3.0'; assert.equal((await atualizarAutomaticamente(f.opcoes)).motivo,'RELEASE_NAO_MAIS_NOVA');
});

test('confirmação CLI exige identidade completa e falha fechada para argumentos desconhecidos', () => {
  assert.equal(lerConfirmacao([]),null);
  assert.equal(lerConfirmacao(['--confirmar','v1.5.0','--sha','a'.repeat(40)]).aceita,true);
  assert.throws(()=>lerConfirmacao(['--confirmar','v1.5.0']));
  assert.throws(()=>lerConfirmacao(['--yes','v1.5.0','--sha','a'.repeat(40)]));
  for(const status of ['aguardando_confirmacao','bloqueado',undefined]) assert.equal(podeIniciarOperacao({status}),false);
  assert.equal(podeIniciarOperacao({status:'atualizado',trava:'revisao_necessaria'}),false);
});

test('ZIP não trata número de versão como prova e detecta edição posterior', async t => {
  const f=fixture(t);
  fs.writeFileSync(path.join(f.raiz,'vagas/package.json'),JSON.stringify({name:'jobrelay',version:'1.5.0'}));
  assert.equal((await atualizarAutomaticamente(f.opcoes)).status,'aguardando_confirmacao'); assert.equal(f.downloads(),0);
  assert.equal((await atualizarAutomaticamente({...f.opcoes,confirmacao:f.aceite})).status,'atualizado');
  fs.writeFileSync(path.join(f.raiz,'vagas/src/novo.js'),'minha edição');
  assert.equal((await atualizarAutomaticamente(f.opcoes)).motivo,'CODIGO_LOCAL_MODIFICADO'); assert.equal(f.downloads(),1);
});

test('ZIP recusa redirect para outro host e preserva o original', async t => {
  const f=fixture(t);
  const r=await atualizarAutomaticamente({...f.opcoes,confirmacao:f.aceite,fetchImpl:async()=>({status:302,headers:new Headers({location:'https://evil.invalid/asset'})})});
  assert.equal(r.motivo,'ASSET_ORIGEM_INVALIDA');
  assert.equal(fs.readFileSync(path.join(f.raiz,'vagas/src/atualizacao.js'),'utf8'),'original');
});

test('reversão concorrente incerta preserva a trava e a edição externa', async t => {
  const f=fixture(t);
  const r=await atualizarAutomaticamente({...f.opcoes,confirmacao:f.aceite,antesGravarZip:nome=>{
    if(nome==='vagas/src/novo.js'){fs.writeFileSync(path.join(f.raiz,'vagas/src/atualizacao.js'),'edição externa');throw new Error('interrupção');}
  }});
  assert.equal(r.motivo,'ZIP_ROLLBACK_INCERTO'); assert.equal(r.trava,'revisao_necessaria');
  assert.equal(fs.existsSync(path.join(f.raiz,'vagas/data/operacao/.atualizacao.lock')),true);
  assert.equal(fs.readFileSync(path.join(f.raiz,'vagas/src/atualizacao.js'),'utf8'),'edição externa');
});

test('ZIP rejeita CRC adulterado, tipo symlink e limite do diretório', async t => {
  const f=fixture(t);
  const crc=Buffer.from(f.bytes); const central=crc.indexOf(Buffer.from([0x50,0x4b,0x01,0x02])); crc.writeUInt32LE(123,central+16);
  assert.throws(()=>lerZip(crc),{codigo:'ZIP_INVALIDO'});
  const link=Buffer.from(f.bytes); link.writeUInt32LE((0xa1ff*65536)>>>0,central+38);
  assert.throws(()=>lerZip(link),{codigo:'ZIP_LINK'});
  const quantidade=Buffer.from(f.bytes); quantidade.writeUInt16LE(6001,quantidade.length-12);
  assert.throws(()=>lerZip(quantidade),{codigo:'ZIP_INVALIDO'});
});

test('ZIP exige migração para código fora da allowlist ou remoção de arquivo gerido', async t => {
  const f=fixture(t,{'jobrelay/novo-runtime/exec.js':'código fora da allowlist'});
  assert.equal((await atualizarAutomaticamente({...f.opcoes,confirmacao:f.aceite})).motivo,'ZIP_FORA_ALLOWLIST');
  const g=fixture(t);assert.equal((await atualizarAutomaticamente({...g.opcoes,confirmacao:g.aceite})).status,'atualizado');
  const registro=path.join(g.raiz,'vagas/data/atualizacao-instalacao.json');
  const anterior=JSON.parse(fs.readFileSync(registro));
  fs.writeFileSync(path.join(g.raiz,'vagas/src/antigo.js'),'antigo');
  anterior.arquivos.push({nome:'vagas/src/antigo.js',sha256:hash(Buffer.from('antigo'))});fs.writeFileSync(registro,JSON.stringify(anterior));
  g.release.tagSha='c'.repeat(40);g.aceite.tagSha=g.release.tagSha;
  assert.equal((await atualizarAutomaticamente({...g.opcoes,confirmacao:g.aceite})).motivo,'ZIP_REMOCAO_EXIGE_MIGRACAO');
});
