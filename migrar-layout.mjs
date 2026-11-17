// Migração local, sem rede. Não conclui onboarding nem altera opt-ins.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const raiz = path.resolve(process.argv[2] || '.');
const diario = path.join(raiz, 'local/migracao-layout.json');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const existe = p => { try { fs.lstatSync(p); return true; } catch(e) { if(e.code==='ENOENT') return false; throw e; } };
// Nenhuma gravação, leitura de journal ou semente precede estes guards.
function validarAlvo(alvo, tipo = null) {
 const absoluto=path.resolve(alvo);
 if(absoluto!==raiz && !absoluto.startsWith(raiz+path.sep)) throw Error('MIGRACAO_CAMINHO_INSEGURO');
 let atual=path.parse(absoluto).root;
 const partes=path.relative(atual,absoluto).split(path.sep).filter(Boolean);
 for(let i=0;i<partes.length;i++) {
  atual=path.join(atual,partes[i]);if(!existe(atual))return;
  const st=fs.lstatSync(atual);const final=i===partes.length-1;
  if(st.isSymbolicLink() || (!final&&!st.isDirectory()) || (final&&tipo==='diretorio'&&!st.isDirectory()) || (final&&tipo==='arquivo'&&(!st.isFile()||st.nlink!==1))) throw Error('MIGRACAO_CAMINHO_INSEGURO');
 }
}
validarAlvo(raiz,'diretorio');
for(const n of ['local','local/config','local/data','local/aplicacao','local/curriculo','app','core','core/config','core/config/modelos','skills','docs','docs/core','docs/coleta','docs/specs','docs/aplicacao','docs/curriculo'])validarAlvo(path.join(raiz,n),'diretorio');
for(const n of ['local/migracao-layout.json','local/.env','local/.env.local','.gitignore'])validarAlvo(path.join(raiz,n),'arquivo');
for(const n of ['docs/aplicacao/README.md','docs/curriculo/materiais-fonte.md'])validarAlvo(path.join(raiz,n),'arquivo');
// A configuração antiga também será percorrida: validar antes de mover vagas.
const antiga=path.join(raiz,'vagas');
const coreFonte=existe(antiga)&&!fs.lstatSync(antiga).isSymbolicLink()?antiga:path.join(raiz,'core');
validarAlvo(coreFonte,'diretorio');
const configFonte=path.join(coreFonte,'config');validarAlvo(configFonte,'diretorio');
if(existe(configFonte))for(const n of fs.readdirSync(configFonte)) {
 const a=path.join(configFonte,n),b=path.join(raiz,'local/config',n);
 if(n==='modelos')continue;
 validarAlvo(b);
 if(fs.lstatSync(a).isSymbolicLink()) {
  if(path.resolve(path.dirname(a),fs.readlinkSync(a))!==b || !existe(b))throw Error('MIGRACAO_CAMINHO_INSEGURO');
 } else validarAlvo(a);
}
for(const n of ['base_content_en.json','base_content_pt.json','base_resume_en.pdf','base_resume_pt.pdf','materiais-fonte','builds'])validarAlvo(path.join(raiz,'local/curriculo',n));
function validarFonteAlias(a,b,tipo=null) {
 validarAlvo(b,tipo);
 if(!existe(a))return;
 if(fs.lstatSync(a).isSymbolicLink()) { if(path.resolve(path.dirname(a),fs.readlinkSync(a))!==b || !existe(b))throw Error('MIGRACAO_CAMINHO_INSEGURO'); }
 else validarAlvo(a,tipo);
}
for(const [a,b] of [['local/aplicacao/README.md','docs/aplicacao/README.md'],['local/curriculo/materiais-fonte/README.md','docs/curriculo/materiais-fonte.md']])validarFonteAlias(path.join(raiz,a),path.join(raiz,b),'arquivo');
validarFonteAlias(path.join(coreFonte,'data'),path.join(raiz,'local/data'),'diretorio');
for(const n of ['.env','.env.local'])validarFonteAlias(path.join(coreFonte,n),path.join(raiz,'local',n),'arquivo');
const skillsAntiga=path.join(raiz,'Skills');
const skillsFonte=existe(skillsAntiga)&&!fs.lstatSync(skillsAntiga).isSymbolicLink()?skillsAntiga:path.join(raiz,'skills');
validarAlvo(skillsFonte,'diretorio');validarAlvo(path.join(skillsFonte,'adapt-resume'),'diretorio');
for(const n of ['base_content_en.json','base_content_pt.json','base_resume_en.pdf','base_resume_pt.pdf','materiais-fonte','builds'])validarFonteAlias(path.join(skillsFonte,'adapt-resume',n),path.join(raiz,'local/curriculo',n));
const modelosPrevios=path.join(raiz,'core/config/modelos');
for(const grupo of ['config','aplicacao','data','curriculo']) {
 const dir=path.join(modelosPrevios,grupo);validarAlvo(dir,'diretorio');
 if(!existe(dir))continue;
 for(const n of fs.readdirSync(dir)) {
  const a=path.join(dir,n);validarAlvo(a);
  if(fs.lstatSync(a).isDirectory())continue;
  validarAlvo(a,'arquivo');validarAlvo(path.join(raiz,'local',grupo,n),'arquivo');
 }
}
// Preflight: uma colisão conhecida não inicia movimentos parciais.
for(const [a,b] of [['interface','app'],['vagas','core'],['Skills','skills'],['onboarding','app/onboarding'],['quadro','app/quadro'],['aplicacao','local/aplicacao'],['coleta','docs/coleta'],['specs','docs/specs']]) {
 const x=path.join(raiz,a),y=path.join(raiz,b);
 if(existe(x)&&fs.lstatSync(x).isSymbolicLink()&&(!existe(y)||fs.statSync(x).ino!==fs.statSync(y).ino)) throw Error('ORIGEM_SIMBOLICA_INESPERADA:'+a);
 if(existe(x)&&existe(y)&&fs.statSync(x).ino!==fs.statSync(y).ino) throw Error('CONFLITO_PREFLIGHT:'+a);
}
function inventarioEstado() {
 const mapa={};
 const ignorar=new Set(['.git','node_modules','.astro','dist','.migracao-layout.lock','__pycache__']);
 function visitar(dir) { for(const n of fs.readdirSync(dir).sort()) {
  if(ignorar.has(n))continue;
  const a=path.join(dir,n),rel=path.relative(raiz,a);
  if(rel==='local/migracao-layout.json'||rel.startsWith('local/migracao-layout.json.'))continue;
  const st=fs.lstatSync(a);
  mapa[rel]={tipo:st.isSymbolicLink()?'link':st.isDirectory()?'diretorio':'arquivo',modo:st.mode&0o777,
   ...(st.isSymbolicLink()?{destino:fs.readlinkSync(a)}:st.isFile()?{sha256:hash(a)}:{})};
  if(st.isDirectory())visitar(a);
 }}
 visitar(raiz);return mapa;
}
const hashEstado = mapa => crypto.createHash('sha256').update(JSON.stringify(mapa)).digest('hex');
const lock=path.join(raiz,'.migracao-layout.lock');
try { fs.mkdirSync(lock,{mode:0o700}); } catch { throw Error('MIGRACAO_OCUPADA: confira a execução anterior; a trava não é tomada por timeout'); }
try {
let estado;
try { estado = existe(diario) ? JSON.parse(fs.readFileSync(diario)) : { versao: 1, estado: 'iniciada', etapas: [] }; } catch { throw Error('MIGRACAO_JOURNAL_INVALIDO'); }
if(estado?.versao!==1 || !Array.isArray(estado.etapas) || estado.etapas.some(e=>typeof e!=='string')) throw Error('MIGRACAO_JOURNAL_INVALIDO');
if(estado.estado!=='concluida' && estado.integridade && hashEstado(estado.integridade)!==hashEstado(inventarioEstado())) throw Error('MIGRACAO_ESTADO_DIVERGENTE: reconcilie com o checkpoint ou restaure o backup antes de retomar');
estado.eventos ||= [];estado.mapeamentos ||= {};
function salvar() { validarAlvo(path.dirname(diario),'diretorio');validarAlvo(diario,'arquivo');fs.mkdirSync(path.dirname(diario), { recursive:true }); estado.integridade=inventarioEstado();estado.hashIntegridade=hashEstado(estado.integridade);const temp=diario+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(estado,null,2),{flag:'wx',mode:0o600});fs.renameSync(temp,diario); }
function etapa(chave,acao) { if (estado.etapas.includes(chave)) return; const hashAntes=hashEstado(inventarioEstado());acao();estado.etapas.push(chave);estado.eventos.push({etapa:chave,...(estado.mapeamentos[chave]||{}),hashAntes,hashDepois:hashEstado(inventarioEstado())});salvar(); if(process.env.MIGRACAO_PARAR_APOS===chave) throw Error('MIGRACAO_INTERROMPIDA_PARA_TESTE'); }
function mover(origem,destino) {
 const a=path.join(raiz,origem),b=path.join(raiz,destino);
 estado.mapeamentos[`mover:${origem}`]={origem,destino};
 etapa(`mover:${origem}`,()=>{
  const caso=a+'.layout-case';if(existe(caso)&&!existe(a)&&!existe(b)) fs.renameSync(caso,b);
  if(existe(a)&&fs.lstatSync(a).isSymbolicLink()) { if(fs.realpathSync(a)!==fs.realpathSync(b)) throw Error('CONFLITO:'+origem); return; }
  if(a!==b && a.toLowerCase()===b.toLowerCase() && existe(a)&&existe(b) && fs.statSync(a).ino===fs.statSync(b).ino) { const tmp=a+'.layout-case';fs.renameSync(a,tmp);fs.renameSync(tmp,b);return; }
  if(existe(a)&&existe(b)) throw Error('CONFLITO:'+origem+' → '+destino);
  if(!existe(a)&&!existe(b)) return;
  if(existe(a)) { fs.mkdirSync(path.dirname(b),{recursive:true}); fs.renameSync(a,b); }
 });
}
function alias(origem,destino) {
 const a=path.join(raiz,origem),b=path.join(raiz,destino);
 if(!existe(b)) return;
 estado.mapeamentos[`alias:${origem}:v1`]={origem,destino};
 etapa(`alias:${origem}:v1`,()=>{
  if(existe(a)) { if(fs.statSync(a).ino!==fs.statSync(b).ino) throw Error('CONFLITO_ALIAS:'+origem); return; }
  fs.mkdirSync(path.dirname(a),{recursive:true});fs.symlinkSync(path.relative(path.dirname(a),b),a,fs.statSync(b).isDirectory()?'dir':'file');
 });
}
// Modelos vêm do artefato público, nunca dos dados da instalação.
const semente=path.join(raiz,'core/config/modelos');
for(const grupo of ['config','aplicacao','data','curriculo']) {
 const dir=path.join(semente,grupo);if(!existe(dir))continue;
 for(const n of fs.readdirSync(dir)) {
  const a=path.join(dir,n),b=path.join(raiz,'local',grupo,n);
  if(fs.statSync(a).isDirectory())continue;
  if(!existe(b)){fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(a,b,fs.constants.COPYFILE_EXCL);}
 }
}
salvar();
for(const [a,b] of [['interface','app'],['vagas','core'],['Skills','skills'],['onboarding','app/onboarding'],['quadro','app/quadro'],['aplicacao','local/aplicacao'],['coleta','docs/coleta'],['specs','docs/specs']]) mover(a,b);
mover('core/test','core/tests');
// Defaults distribuídos ficam separados das escolhas da instalação.
const modelos=path.join(raiz,'core/config/modelos');fs.mkdirSync(modelos,{recursive:true});
const config=path.join(raiz,'core/config');
if(existe(config)) for(const n of fs.readdirSync(config)) {
 if(n==='modelos') continue;
 const a=path.join(config,n);if(fs.lstatSync(a).isDirectory()) continue;
 etapa(`config:${n}`,()=>{
  const b=path.join(raiz,'local/config',n);fs.mkdirSync(path.dirname(b),{recursive:true});
  if(fs.lstatSync(a).isSymbolicLink()) { if(fs.realpathSync(a)!==fs.realpathSync(b)) throw Error('CONFLITO_CONFIG:'+n);return; }
  if(existe(b)) { if(hash(a)!==hash(b)) throw Error('CONFLITO_CONFIG:'+n);fs.unlinkSync(a); }
  else fs.renameSync(a,b);
  fs.symlinkSync(path.relative(config,b),a);
 });
}
const localConfig=path.join(raiz,'local/config');
if(existe(localConfig))for(const n of fs.readdirSync(localConfig))alias('core/config/'+n,'local/config/'+n);
mover('core/data','local/data');alias('core/data','local/data');
etapa('pasta-aplicacao',()=>fs.mkdirSync(path.join(raiz,'local/aplicacao'),{recursive:true,mode:0o700}));
for(const [a,b] of [['vagas','core'],['core/test','core/tests'],['Skills','skills'],['interface','app'],['onboarding','app/onboarding'],['quadro','app/quadro'],['aplicacao','local/aplicacao'],['coleta','docs/coleta'],['specs','docs/specs']]) alias(a,b);
for(const n of ['.env','.env.local']) { mover('core/'+n,'local/'+n);if(!existe(path.join(raiz,'local/'+n))) fs.writeFileSync(path.join(raiz,'local/'+n),'',{flag:'wx',mode:0o600});alias('core/'+n,'local/'+n); }
// Documentação do núcleo sai do motor; aliases mantêm links de instalações antigas.
for(const n of fs.readdirSync(path.join(raiz,'core'))) if(n.endsWith('.md')) { mover('core/'+n,'docs/core/'+n);alias('core/'+n,'docs/core/'+n); }
for(const n of ['base_content_en.json','base_content_pt.json','base_resume_en.pdf','base_resume_pt.pdf','materiais-fonte','builds']) {
 mover('skills/adapt-resume/'+n,'local/curriculo/'+n);alias('skills/adapt-resume/'+n,'local/curriculo/'+n);
}
// Pastas de trabalho existem mesmo numa instalação sem materiais ou builds prévios.
for(const n of ['materiais-fonte','builds']) {
 etapa(`pasta-curriculo:${n}`,()=>fs.mkdirSync(path.join(raiz,'local/curriculo',n),{recursive:true,mode:0o700}));
 alias('skills/adapt-resume/'+n,'local/curriculo/'+n);
}
// Guias têm dono em docs; aliases locais faltantes preservam a leitura anterior.
for(const [a,b] of [['local/aplicacao/README.md','docs/aplicacao/README.md'],['local/curriculo/materiais-fonte/README.md','docs/curriculo/materiais-fonte.md']]) {
 const existente=path.join(raiz,a);
 if(!existe(existente)||fs.lstatSync(existente).isSymbolicLink())alias(a,b);
}
const docsCore=path.join(raiz,'docs/core');
if(existe(docsCore))for(const n of fs.readdirSync(docsCore))if(n.endsWith('.md'))alias('core/'+n,'docs/core/'+n);
fs.mkdirSync(path.join(raiz,'local/data'),{recursive:true});
const ignore=path.join(raiz,'.gitignore');
etapa('ignorar-local',()=>{const regras=['/local/', '/vagas', '/aplicacao', '/coleta', '/interface', '/onboarding', '/quadro', '/specs', '/core/data', '/core/test', '/core/*.md', '/core/config/*', '!/core/config/modelos/', '/skills/adapt-resume/base_content_*.json', '/skills/adapt-resume/base_resume_*.pdf', '/skills/adapt-resume/materiais-fonte', '/skills/adapt-resume/builds'];const anterior=fs.readFileSync(ignore,'utf8');const faltantes=regras.filter(r=>!anterior.split('\n').includes(r));if(faltantes.length)fs.appendFileSync(ignore,'\n'+faltantes.join('\n')+'\n');});
// Só o alias maiúsculo realmente criado em filesystem sensível a caixa usa exclude local.
const aliasSkills=path.join(raiz,'Skills');
if(existe(aliasSkills)&&fs.lstatSync(aliasSkills).isSymbolicLink()&&existe(path.join(raiz,'.git'))) {
 const pastaGit=path.join(raiz,'.git');validarAlvo(pastaGit,'diretorio');
 const exclusao=path.join(pastaGit,'info/exclude');validarAlvo(exclusao,'arquivo');
 fs.mkdirSync(path.dirname(exclusao),{recursive:true});
 const anterior=existe(exclusao)?fs.readFileSync(exclusao,'utf8'):'';
 if(!anterior.split('\n').includes('/Skills'))fs.appendFileSync(exclusao,'\n/Skills\n');
}

estado.estado='concluida';salvar();console.log(JSON.stringify({estado:estado.estado,etapas:estado.etapas.length,raiz}));

} finally { fs.rmdirSync(lock); }
