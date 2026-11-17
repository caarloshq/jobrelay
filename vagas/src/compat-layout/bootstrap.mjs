// Bootstrap de compatibilidade. Sem rede, login, candidatura ou dependências externas.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const exists=p=>{try{fs.lstatSync(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
// Publicação atômica: metadata completa em arquivo exclusivo; link() publica sem sobrescrever.
// Nenhum takeover por tempo. PID vivo/reutilizado ou identidade incerta mantêm a trava.
function adquirir(root,digest){
 const target=path.join(root,'.ponte-layout.lock');
 function owner(file){const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.nlink<1||st.nlink>2||st.size>8192)throw Error('PONTE_TRAVA_INVALIDA');const data=JSON.parse(fs.readFileSync(file));if(data.contrato!==1||!Number.isInteger(data.pid)||data.pid<=0||!/^[-a-f0-9]{36}$/.test(data.nonce)||data.raiz!==fs.realpathSync(root)||!/^[a-f0-9]{64}$/.test(data.digest))throw Error('PONTE_TRAVA_INVALIDA');return {st,data};}
 function same(file,expected){if(!exists(file))throw Error('PONTE_TRAVA_MUDOU');const x=owner(file);if(x.st.dev!==expected.st.dev||x.st.ino!==expected.st.ino||x.data.nonce!==expected.data.nonce||x.data.pid!==expected.data.pid)throw Error('PONTE_TRAVA_MUDOU');return x;}
 function dead(pid){try{process.kill(pid,0);return false;}catch(e){if(e.code==='ESRCH')return true;if(e.code==='EPERM')return false;throw e;}}
 if(exists(target)){
  const prior=owner(target);if(prior.data.digest!==digest)throw Error('PONTE_TRAVA_DIGEST_DIVERGENTE');if(!dead(prior.data.pid))throw Error('PONTE_OCUPADA');
  const staging=path.join(root,'.ponte-layout.owner-'+prior.data.nonce);
  if(prior.st.nlink===2){if(!exists(staging))throw Error('PONTE_TRAVA_INVALIDA');same(staging,prior);}
  same(target,prior);if(!dead(prior.data.pid))throw Error('PONTE_OCUPADA');
  const quarantine=path.join(root,'.ponte-layout.orfao-'+prior.data.nonce);if(exists(quarantine))throw Error('PONTE_TRAVA_INVALIDA');
  fs.renameSync(target,quarantine);try{same(quarantine,prior);if(!dead(prior.data.pid))throw Error('PONTE_OCUPADA');}catch(e){if(!exists(target)){fs.linkSync(quarantine,target);fs.unlinkSync(quarantine);}throw e;}
  if(exists(staging)){same(staging,prior);fs.unlinkSync(staging);}
 }
 const data={contrato:1,pid:process.pid,nonce:crypto.randomUUID(),raiz:fs.realpathSync(root),digest};const stage=path.join(root,'.ponte-layout.owner-'+data.nonce);const fd=fs.openSync(stage,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(data));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 try{fs.linkSync(stage,target);}catch(e){fs.unlinkSync(stage);if(e.code==='EEXIST')throw Error('PONTE_OCUPADA');throw e;}const identity=owner(target);fs.unlinkSync(stage);
 return ()=>{same(target,identity);fs.unlinkSync(target);};
}
export function decodificar(bytes,digest){
 if(bytes.length>16*1024*1024||sha(bytes)!==digest)throw Error('PONTE_PAYLOAD_INTEGRIDADE');
 const p=JSON.parse(bytes);if(p.contrato!==1||!Array.isArray(p.arquivos)||p.arquivos.length>6000)throw Error('PONTE_PAYLOAD_INVALIDO');const seen=new Set();
 for(const e of p.arquivos){const n=e.nome;if(typeof n!=='string'||n!==n.normalize('NFKC')||n.includes('\\')||/[\x00-\x1f:]/.test(n)||n.split('/').some(x=>!x||x==='.'||x==='..'||x==='.git'||x==='node_modules'||/[. ]$/.test(x))||n.startsWith('local/')||!(/^(core|app|skills|docs)\//.test(n)||/^(package\.json|migrar-layout\.mjs|[A-Z][A-Z0-9_.-]*\.md|\.gitignore|LICENSE)$/.test(n)))throw Error('PONTE_PAYLOAD_CAMINHO');const key=n.toLowerCase();if(seen.has(key))throw Error('PONTE_PAYLOAD_DUPLICADO');seen.add(key);e.bytes=Buffer.from(e.conteudo,'base64');if(e.bytes.length>16*1024*1024||sha(e.bytes)!==e.sha256||![0o644,0o755].includes(e.modo))throw Error('PONTE_PAYLOAD_INTEGRIDADE');}
 return p;
}
export function bootstrap(root){
 root=path.resolve(root);const file=path.join(root,'vagas/src/compat-layout/conteudo.json');if(!exists(file))throw Error('PONTE_PAYLOAD_AUSENTE');
 function guard(p,type){const abs=path.resolve(p);if(abs!==root&&!abs.startsWith(root+path.sep))throw Error('PONTE_CAMINHO_INSEGURO');let cur=path.parse(abs).root;for(const part of path.relative(cur,abs).split(path.sep).filter(Boolean)){cur=path.join(cur,part);if(!exists(cur))return;const st=fs.lstatSync(cur);if(st.isSymbolicLink()||(!st.isDirectory()&&cur!==abs)||st.isFile()&&st.nlink!==1||cur===abs&&type==='dir'&&!st.isDirectory()||cur===abs&&type==='file'&&!st.isFile())throw Error('PONTE_CAMINHO_INSEGURO:'+path.relative(root,cur));}}
 guard(root,'dir');guard(file,'file');const digestFile=path.join(root,'vagas/src/compat-layout/conteudo.sha256');guard(digestFile,'file');const p=decodificar(fs.readFileSync(file),fs.readFileSync(digestFile,'utf8').trim());
 // A proteção histórica confundia alguns nomes de código com dados pessoais.
 // Preservar uma alteração nesses módulos não autoriza ativar produto misturado.
 for(const e of p.legados||[])if(/^vagas\/(src|scripts|test)\//.test(e.nome)&&/\.(js|mjs)$/.test(e.nome)){
  const target=path.join(root,e.nome);guard(target,'file');if(!exists(target)||sha(fs.readFileSync(target))!==e.sha256)throw Error('PONTE_CODIGO_LEGADO_MODIFICADO:'+e.nome);
 }
 const journal=path.join(root,'local/migracao-ponte.json'),lock=path.join(root,'.ponte-layout.lock');guard(journal,'file');
 let previous=exists(journal)?JSON.parse(fs.readFileSync(journal)):null;if(previous){const {integridade,...body}=previous;if(previous.contrato!==1||integridade!==sha(Buffer.from(JSON.stringify(body))))throw Error('PONTE_JOURNAL_INVALIDO');}const digest=sha(fs.readFileSync(file));if(previous&&previous.estado==='iniciada'&&previous.digest!==digest)throw Error('PONTE_JOURNAL_GERACAO_DIVERGENTE');
 if(previous?.estado==='concluida'&&previous.digest===digest){
  for(const e of p.arquivos){const f=path.join(root,e.nome);guard(f,'file');if(!exists(f)||sha(fs.readFileSync(f))!==e.sha256)throw Error('PONTE_CODIGO_CANONICO_MODIFICADO:'+e.nome);}
  return {estado:'concluida',digest,arquivos:0};
 }
 // Rechecagem independente depois do término da CLI antiga e antes da primeira escrita.
 for(const prefix of ['vagas/data','local/data']){
  const d=path.join(root,prefix);guard(d,'dir');
  for(const n of ['operacao/.escrita.lock','operacao/.recuperacao.lock','operacao/.atualizacao.lock','navegador/.comando.lock','navegador/.comando.recuperacao.lock','navegador/controle/controlador.lock','navegador/controle/recuperacao.lock'])if(exists(path.join(d,n)))throw Error('PONTE_OPERACAO_ATIVA');
  for(const [n,test] of [['operacao/estado.json',x=>x.contrato!==1||x.status!=='encerrada'],['navegador/acesso-humano.json',x=>x.ativo!==false],['navegador/controle/bloqueio.json',x=>x.ativo!==false],['navegador/controle/checkpoint.json',x=>x.fase!=='encerrada'||x.encerradaDeliberadamente!==true||x.abasProtegidas!==false||x.chromePid||x.daemonPid||!Array.isArray(x.tabs)||x.tabs.length]]){const f=path.join(d,n);guard(f,'file');if(exists(f)&&test(JSON.parse(fs.readFileSync(f))))throw Error('PONTE_OPERACAO_ATIVA');}
  for(const n of ['navegador/s','navegador/r']){const f=path.join(d,n);guard(f,'dir');if(exists(f)&&fs.readdirSync(f).some(n=>n.endsWith('.pid')))throw Error('PONTE_OPERACAO_ATIVA');}
 }
 // Dados legados são cópia congelada de compatibilidade. Após a primeira migração,
 // somente local é dono; nunca reimportar uma cópia antiga sobre escolhas novas.
 const first=!previous||previous.estado!=='concluida';const actions=[];const directories=[];const allowedOld=new Map((p.legados||[]).map(e=>[e.nome.toLowerCase(),e.sha256]));const allowedBase=new Map((p.anteriores||[]).map(e=>[e.nome.toLowerCase(),e.sha256]));const done=previous?.digest===digest?previous:null;
 function add(nome,bytes,mode,source=null){guard(path.join(root,nome),'file');const dest=path.join(root,nome);const old=exists(dest)?sha(fs.readFileSync(dest)):null;const hash=sha(bytes);if(old===hash)return;if(done){const a=done.acoes.find(x=>x.nome===nome);if(!a||old!==a.anterior&&old!==a.sha256)throw Error('PONTE_ESTADO_DIVERGENTE:'+nome);}else if(old!==null&&old!==allowedOld.get(nome.toLowerCase())&&old!==allowedBase.get(nome.toLowerCase())&&old!==previous?.canonicos?.[nome])throw Error('PONTE_CONFLITO:'+nome);actions.push({nome,sha256:hash,anterior:old,modo:mode,bytes,source,anteriorModo:old===null?null:fs.statSync(dest).mode&0o777,...(source&&source!=='semente'?{mtime:fs.statSync(source).mtimeMs,atime:fs.statSync(source).atimeMs,fonteHash:sha(fs.readFileSync(source)),fonteModo:fs.statSync(source).mode&0o777}:{})});}
 for(const e of p.arquivos)add(e.nome,e.bytes,e.modo);
 function copy(src,dst){guard(src);if(!exists(src))return;const st=fs.lstatSync(src);if(st.isDirectory()){guard(path.join(root,dst),'dir');directories.push({nome:dst,modo:st.mode&0o777,existia:exists(path.join(root,dst))});for(const n of fs.readdirSync(src))copy(path.join(src,n),dst+'/'+n);}else add(dst,fs.readFileSync(src),st.mode&0o777,src);}
 if(first){for(const [src,dst] of [['vagas/config','local/config'],['vagas/data','local/data']])copy(path.join(root,src),dst);for(const n of ['PERFIL.md','RESPOSTAS.md','RESPOSTAS-PREENCHIDAS.md','PENDENCIAS-CANDIDATURAS.md','historico'])copy(path.join(root,'aplicacao',n),'local/aplicacao/'+n);for(const n of ['base_content_en.json','base_content_pt.json','base_resume_en.pdf','base_resume_pt.pdf','materiais-fonte','builds'])copy(path.join(root,'Skills/adapt-resume',n),'local/curriculo/'+n);for(const n of ['.env','.env.local'])copy(path.join(root,'vagas',n),'local/'+n);copy(path.join(root,'interface/.env.local'),'app/.env.local');}
 // Sementes neutras só completam ausências; nunca alteram escolhas existentes.
 const planned=new Set(actions.map(x=>x.nome));for(const e of p.arquivos){const match=e.nome.match(/^core\/config\/modelos\/(config|data|aplicacao|curriculo)\/(.+)$/);if(!match)continue;const rel=p.modelos?.[match[1]+'/'+match[2]]||match[1]+'/'+match[2];const n='local/'+rel;const copied=actions.find(a=>a.nome===n);if(first&&copied?.source&&copied.source!=='semente'&&copied.source!=='cadastro'&&sha(fs.readFileSync(copied.source))===allowedBase.get(path.relative(root,copied.source).replaceAll(path.sep,'/').toLowerCase())){copied.bytes=e.bytes;copied.sha256=e.sha256;copied.modeloNeutroAtualizado=true;}else if(!exists(path.join(root,n))&&!planned.has(n)){add(n,e.bytes,0o600,'semente');planned.add(n);}}
 // Canonizar o cadastro ZIP sem esquecer os wrappers ainda instalados.
 const registryName='local/data/atualizacao-instalacao.json';
 if(first){const src=path.join(root,'vagas/data/atualizacao-instalacao.json');if(exists(src)){
  const registry=JSON.parse(fs.readFileSync(src));if(registry.contrato!==1||!Array.isArray(registry.arquivos))throw Error('PONTE_REGISTRO_ZIP_INVALIDO');
  const map=new Map(registry.arquivos.map(e=>[e.nome.toLowerCase(),e]));
  for(const e of p.arquivos)if(/^(core|app|skills|docs)\//.test(e.nome)||['package.json','migrar-layout.mjs','.gitignore','README.md','AGENTS.md','CLAUDE.md','ATUALIZAR.md','ONBOARDING.md','DESIGN.md','PRODUCT.md','LICENSE'].includes(e.nome))map.set(e.nome.toLowerCase(),{nome:e.nome,sha256:e.sha256});
  registry.arquivos=[...map.values()];registry.layout='core-local';registry.ponteDigest=digest;const bytes=Buffer.from(JSON.stringify(registry));const action=actions.find(a=>a.nome===registryName);if(action){action.bytes=bytes;action.sha256=sha(bytes);}else add(registryName,bytes,0o600,'cadastro');
 }}
 if(done)for(const record of done.acoes){const action=actions.find(a=>a.nome===record.nome);if(action&&(action.sha256!==record.sha256||record.fonteHash&&action.fonteHash!==record.fonteHash))throw Error('PONTE_ENTRADA_MUDOU:'+record.nome);if(!action){const target=path.join(root,record.nome);guard(target,'file');if(!exists(target)||sha(fs.readFileSync(target))!==record.sha256)throw Error('PONTE_ESTADO_DIVERGENTE:'+record.nome);}}
 // Preflight completo acima: conflito tardio no plano não cria journal nem sobrescreve nada.
 for(const a of actions)if(a.fonteHash){guard(a.source,'file');if(sha(fs.readFileSync(a.source))!==a.fonteHash||(fs.statSync(a.source).mode&0o777)!==a.fonteModo)throw Error('PONTE_FONTE_MUDOU');}
 const liberar=adquirir(root,digest);try{
 fs.mkdirSync(path.dirname(journal),{recursive:true,mode:0o700});const state=done||{contrato:1,digest,estado:'iniciada',acoes:actions.map(({bytes,source,...a})=>({...a,estado:'planejado'})),canonicos:previous?.canonicos||{},diretorios:directories};
 const save=()=>{guard(journal,'file');const tmp=journal+'.'+crypto.randomUUID()+'.tmp';const {integridade:oldIntegrity,...body}=state;state.integridade=sha(Buffer.from(JSON.stringify(body)));fs.writeFileSync(tmp,JSON.stringify(state),{flag:'wx',mode:0o600});fs.renameSync(tmp,journal);};
 const backup=path.join(root,'local/backup-migracao',digest);guard(backup,'dir');fs.mkdirSync(backup,{recursive:true,mode:0o700});
 save();for(const a of actions){let record=state.acoes.find(x=>x.nome===a.nome);const target=path.join(root,a.nome);guard(target,'file');const actual=exists(target)?sha(fs.readFileSync(target)):null;
 if(record&&actual===record.anterior&&record.anterior!==null&&!record.backup){const b=path.join(backup,a.nome);guard(b,'file');fs.mkdirSync(path.dirname(b),{recursive:true,mode:0o700});if(!exists(b)){fs.copyFileSync(target,b,fs.constants.COPYFILE_EXCL);fs.chmodSync(b,record.anteriorModo);}else if(sha(fs.readFileSync(b))!==record.anterior)throw Error('PONTE_BACKUP_DIVERGENTE');record.backup=true;save();}
 if(record){if(actual===record.sha256){record.estado='gravado';save();continue;}if(actual!==record.anterior)throw Error('PONTE_ESTADO_DIVERGENTE:'+a.nome);}else{if(actual!==a.anterior)throw Error('PONTE_ESTADO_DIVERGENTE:'+a.nome);record={nome:a.nome,sha256:a.sha256,anterior:a.anterior,modo:a.modo,anteriorModo:a.anteriorModo,estado:'planejado'};if(a.anterior!==null){const b=path.join(backup,a.nome);guard(b,'file');fs.mkdirSync(path.dirname(b),{recursive:true,mode:0o700});fs.copyFileSync(target,b,fs.constants.COPYFILE_EXCL);fs.chmodSync(b,a.anteriorModo);}state.acoes.push(record);save();}
 fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});const tmp=path.join(path.dirname(target),'.ponte-'+crypto.randomUUID());fs.writeFileSync(tmp,a.bytes,{flag:'wx',mode:a.modo});fs.chmodSync(tmp,a.modo);fs.renameSync(tmp,target);if(a.mtime)fs.utimesSync(target,a.atime/1000,a.mtime/1000);record.estado='gravado';save();if(process.env.JOBRELAY_PONTE_PARAR_APOS===a.nome)throw Error('PONTE_INTERRUPCAO_TESTE');}
 for(const e of p.arquivos)state.canonicos[e.nome]=e.sha256;
 for(const d of state.estado==='concluida'?[]:(state.diretorios||[])){guard(path.join(root,d.nome),'dir');fs.mkdirSync(path.join(root,d.nome),{recursive:true,mode:d.modo});if(!d.existia)fs.chmodSync(path.join(root,d.nome),d.modo);}
 for(const n of ['config','data','aplicacao','curriculo','curriculo/builds','curriculo/materiais-fonte']){guard(path.join(root,'local',n),'dir');fs.mkdirSync(path.join(root,'local',n),{recursive:true,mode:0o700});}
 // Reutilizar dependências sem mover/destruir a instalação anterior.
 for(const [old,nova] of [['vagas/node_modules','core/node_modules'],['interface/node_modules','app/node_modules']])if(exists(path.join(root,old))&&!exists(path.join(root,nova))){guard(path.join(root,old),'dir');fs.symlinkSync(path.relative(path.dirname(path.join(root,nova)),path.join(root,old)),path.join(root,nova),'dir');}
 state.estado='concluida';save();return {estado:state.estado,digest,arquivos:actions.length};
 }finally{liberar();}
}
// Recuperação explícita: só reverte bytes ainda iguais aos gravados pela própria transação.
export function recuperar(root){
 root=path.resolve(root);let ancestor=path.parse(root).root;for(const component of path.relative(ancestor,path.join(root,'local/migracao-ponte.json')).split(path.sep).filter(Boolean)){ancestor=path.join(ancestor,component);if(exists(ancestor)){const st=fs.lstatSync(ancestor);if(st.isSymbolicLink()||st.isFile()&&st.nlink!==1)throw Error('PONTE_CAMINHO_INSEGURO');}}for(const base of ['vagas/data','local/data']){for(const n of ['operacao/.escrita.lock','operacao/.recuperacao.lock','operacao/.atualizacao.lock','navegador/.comando.lock','navegador/controle/controlador.lock'])if(exists(path.join(root,base,n)))throw Error('PONTE_OPERACAO_ATIVA');const file=path.join(root,base,'operacao/estado.json');if(exists(file)&&JSON.parse(fs.readFileSync(file)).status!=='encerrada')throw Error('PONTE_OPERACAO_ATIVA');}
 const f=path.join(root,'local/migracao-ponte.json');const s=JSON.parse(fs.readFileSync(f));const {integridade,...body}=s;if(integridade!==sha(Buffer.from(JSON.stringify(body)))||s.contrato!==1||!Array.isArray(s.acoes))throw Error('PONTE_JOURNAL_INVALIDO');
 const resolve=n=>{if(typeof n!=='string'||n.includes('\\')||n.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('PONTE_CAMINHO_INSEGURO');const p=path.join(root,n);let cur=root;for(const x of n.split('/')){cur=path.join(cur,x);if(exists(cur)){const st=fs.lstatSync(cur);const final=cur===p;if(st.isSymbolicLink()||final&&(!st.isFile()||st.nlink!==1)||!final&&!st.isDirectory())throw Error('PONTE_CAMINHO_INSEGURO');}}return p;};
 // Conferência de todo o lote precede qualquer reversão.
 for(const a of s.acoes){const p=resolve(a.nome);if(!exists(p)){if(a.anterior!==null&&a.estado==='gravado')throw Error('PONTE_RECUPERACAO_CONFLITO');continue;}const h=sha(fs.readFileSync(p));if(h!==a.sha256&&h!==a.anterior)throw Error('PONTE_RECUPERACAO_CONFLITO');if(a.anterior!==null&&h===a.sha256){const b=resolve('local/backup-migracao/'+s.digest+'/'+a.nome);if(!exists(b)||sha(fs.readFileSync(b))!==a.anterior)throw Error('PONTE_BACKUP_DIVERGENTE');}}
 const liberar=adquirir(root,s.digest);try{
 for(const a of [...s.acoes].reverse()){const p=resolve(a.nome);if(!exists(p)||sha(fs.readFileSync(p))===a.anterior)continue;if(a.anterior===null)fs.unlinkSync(p);else{const backup=resolve('local/backup-migracao/'+s.digest+'/'+a.nome);const tmp=path.join(path.dirname(p),'.recuperar-'+crypto.randomUUID());try{fs.copyFileSync(backup,tmp,fs.constants.COPYFILE_EXCL);if(sha(fs.readFileSync(tmp))!==a.anterior)throw Error('PONTE_BACKUP_DIVERGENTE');fs.chmodSync(tmp,a.anteriorModo);resolve(a.nome);fs.renameSync(tmp,p);}finally{if(exists(tmp))fs.unlinkSync(tmp);}}}
 s.estado='revertida';const {integridade:old,...bodyAfter}=s;s.integridade=sha(Buffer.from(JSON.stringify(bodyAfter)));resolve('local/migracao-ponte.json');const temp=f+'.recuperar-'+crypto.randomUUID();fs.writeFileSync(temp,JSON.stringify(s),{flag:'wx',mode:0o600});fs.renameSync(temp,f);return {estado:s.estado};
 }finally{liberar();}
}
