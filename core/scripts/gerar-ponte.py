"""Ponte gerada de uma base pública fixa; nunca lê dados da instalação."""
from pathlib import Path
import json,base64,hashlib,subprocess,re,os,sys
ROOT=Path(__file__).resolve().parents[2]
def protected(n):
 p=n.lower();return any(x=='.env' or x.startswith('.env.') or x.startswith('regras-do-projeto') for x in p.split('/')) or bool(re.search(r'(^|/)(perfil|respostas|respostas-preenchidas)([.-]|$)',p)) or any(p.startswith(x) for x in ['historico/','aplicacao/historico/','backups/','backup/','config/','data/','vagas/config/','vagas/data/','revisoes/','curriculo/','skills/adapt-resume/materiais-fonte/','skills/adapt-resume/builds/']) or bool(re.search(r'(^|/)(base_content_[^/]+\.json|base_resume_[^/]+\.(pdf|docx))$',p))
def baseline(root):
 p=root/'core/config/compat-153.json'
 if p.exists():return json.loads(p.read_text())
 names=subprocess.check_output(['git','-C',str(root),'ls-tree','-r','--name-only','v1.5.3']).decode().splitlines();out=[]
 for n in names:
  data=subprocess.check_output(['git','-C',str(root),'show','v1.5.3:'+n]);out.append({'nome':n,'conteudo':base64.b64encode(data).decode()})
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(out,separators=(',',':')));return out

def destino(n):
 for a,b in [('vagas/src/','core/src/'),('vagas/scripts/','core/scripts/'),('vagas/test/','core/tests/'),('Skills/','skills/'),('interface/','app/')]:
  if n.startswith(a):return (b+n[len(a):]).replace('core/src/respostas.js','core/src/banco-respostas.js').replace('core/scripts/respostas.mjs','core/scripts/gerir-respostas.mjs')
 return n

def facade(n,target,root):
 rel=os.path.relpath(root/'vagas/src/compat-layout/bootstrap.mjs',(root/n).parent).replace(os.sep,'/');rel=rel if rel.startswith('.') else './'+rel
 rootrel=os.path.relpath(root,(root/n).parent).replace(os.sep,'/')
 pre="// Fachada transitória gerada; fonte canônica: "+target+"\nimport {bootstrap} from "+json.dumps(rel)+";\nimport {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';\nconst raiz=fileURLToPath(new URL("+json.dumps(rootrel+'/')+",import.meta.url));await bootstrap(raiz);\nconst alvo=path.join(raiz,"+json.dumps(target)+");\n"
 source=(root/target).read_text() if (root/target).exists() else ''
 if '/scripts/' in n:
  return (pre+"process.argv[1]=alvo;await import(pathToFileURL(alvo).href);\n").encode()
 names=set(re.findall(r'export\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)',source))
 for group in re.findall(r'export\s*\{([^}]+)\}',source):
  for item in group.split(','):
   name=item.strip().split(' as ')[-1].strip()
   if re.fullmatch(r'\w+',name):names.add(name)
 out=pre+"const modulo=await import(pathToFileURL(alvo).href);\n"+''.join('export const '+x+'=modulo.'+x+';\n' for x in sorted(names))
 if re.search(r'export\s+default',source):out+='export default modulo.default;\n'
 return out.encode()

def gerar(root,gravar=True):
 if not gravar and not (root/'core/config/compat-153.json').exists():raise RuntimeError('PONTE_BASE_AUSENTE')
 base=baseline(root);legacy={}
 if gravar:
  for item in base:
   target=root/item['nome']
   if protected(item['nome']) and target.exists() and (target.is_symlink() or target.read_bytes()!=base64.b64decode(item['conteudo'])):raise RuntimeError('PONTE_FONTE_PROTEGIDA_MODIFICADA: '+item['nome'])
 for item in base:
  n=item['nome'];raw=base64.b64decode(item['conteudo']);target=destino(n)
  if protected(n):data=raw
  elif n.startswith(('vagas/','Skills/','interface/')):
   if n.endswith(('.js','.mjs')):data=facade(n,target,root)
   elif n=='vagas/package.json':
    pkg=json.loads((root/'core/package.json').read_text());old=json.loads(raw);pkg['dependencies']=old.get('dependencies',{});pkg['devDependencies']=old.get('devDependencies',{});data=(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n').encode()
   else:data=raw
  elif (root/n).is_file() and not (root/n).is_symlink():data=(root/n).read_bytes()
  else:data=raw
  legacy[n]=data
  # Somente fachadas e sentinelas ausentes na fonte; nunca sobrescrever fonte canônica.
  if gravar and (n.startswith('vagas/') or protected(n)):
   p=root/n
   if p.is_symlink():raise RuntimeError('Destino simbólico: '+n)
   p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 return legacy
if __name__=='__main__':print('fachadas',len(gerar(ROOT)))
