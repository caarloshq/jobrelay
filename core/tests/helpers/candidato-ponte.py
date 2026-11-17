"""Objeto Git sintético em árvore temporária; nunca move refs do produto."""
from pathlib import Path
import subprocess,sys,runpy,json,base64,os
root=Path(sys.argv[1]).resolve();parent=sys.argv[2];origin=Path(sys.argv[3]).resolve()
if root==origin or (root/'.git').exists():raise SystemExit('Fixture precisa de árvore isolada sem Git.')
env={**os.environ,'GIT_AUTHOR_NAME':'Fixture','GIT_AUTHOR_EMAIL':'fixture@example.invalid','GIT_COMMITTER_NAME':'Fixture','GIT_COMMITTER_EMAIL':'fixture@example.invalid'}
def git(*a,input=None):return subprocess.check_output(['git','-C',str(root),*a],input=input,env=env,stderr=subprocess.PIPE).decode().strip()
git('init');git('fetch',str(origin),parent);git('read-tree',parent)
p=json.loads((root/'vagas/src/compat-layout/conteudo.json').read_text());names={e['nome'] for e in p['arquivos']}
for n in git('ls-files').splitlines():
 if n.startswith(('core/','app/','skills/','docs/')) and n not in names:git('update-index','--force-remove','--',n)
def add(n,data,mode=0o644):
 blob=git('hash-object','-w','--stdin',input=data);git('update-index','--add','--cacheinfo',('100755' if mode&0o111 else '100644')+','+blob+','+n)
for e in p['arquivos']:add(e['nome'],base64.b64decode(e['conteudo']),e['modo'])
mod=runpy.run_path(str(root/'core/scripts/gerar-ponte.py'))
for e in mod['baseline'](root):
 if mod['protected'](e['nome']):add(e['nome'],base64.b64decode(e['conteudo']))
for f in (root/'vagas').rglob('*'):
 n=f.relative_to(root).as_posix()
 if f.is_file() and (n.startswith(('vagas/src/','vagas/scripts/','vagas/test/')) or n in ['vagas/package.json','vagas/package-lock.json','vagas/.gitignore']):add(n,f.read_bytes())
print(git('commit-tree',git('write-tree'),'-p',parent,input=b'Proxima candidata sintetica\n'))
