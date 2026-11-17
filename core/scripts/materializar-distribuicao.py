"""Um único ZIP compatível com o instalador1.5.3; núcleo novo em payload verificado."""
from pathlib import Path
import os,shutil,json,hashlib,sys,zipfile,runpy,base64
preparar='--preparar' in sys.argv
if preparar:sys.argv.remove('--preparar')
src=Path(sys.argv[1]).resolve();dest=Path(sys.argv[2]).resolve()
if dest==src or src in dest.parents:raise SystemExit('Origem e destino precisam ser árvores separadas.')
mod=runpy.run_path(str(src/'core/scripts/gerar-ponte.py'));legacy=mod['gerar'](src,gravar=preparar)
# Novas entradas usuais são fachadas regulares, inclusive nomes canônicos renomeados.
for p in sorted((src/'core/scripts').glob('*.mjs')):
 n='vagas/scripts/'+p.name
 if n not in legacy:
  legacy[n]=mod['facade'](n,'core/scripts/'+p.name,src)
  if preparar:
   q=src/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(legacy[n])
# O casing físico de um checkout APFS pode ser Skills mesmo com paths Git skills/.
# Reusar só os papéis canônicos do payload anterior; não exportar stubs/arquivos desconhecidos.
known_skills=set()
previous=src/'vagas/src/compat-layout/conteudo.json';previous_digest=src/'vagas/src/compat-layout/conteudo.sha256'
if previous.exists():
 oldbytes=previous.read_bytes()
 if not previous_digest.exists() or hashlib.sha256(oldbytes).hexdigest()!=previous_digest.read_text().strip():raise SystemExit('PONTE_PAYLOAD_INTEGRIDADE')
 known_skills={e['nome'] for e in json.loads(oldbytes)['arquivos'] if e['nome'].startswith('skills/')}
entries=[]
for base,dirs,files in os.walk(src,followlinks=False):
 dirs[:]=[d for d in dirs if d not in ['node_modules','.git','local','vagas','__pycache__','.astro','dist','.migracao-layout.lock','.ponte-layout.lock'] and not (Path(base)/d).is_symlink() and not d.startswith('.ponte-layout.')]
 for n in files:
  a=Path(base)/n;rel=a.relative_to(src).as_posix()
  if rel.startswith('Skills/'):
   canonical='skills/'+rel[len('Skills/'):];other=src/canonical
   if canonical in known_skills and (not other.exists() or os.path.samefile(a,other)):rel=canonical
  if a.is_symlink() or n.startswith('.ponte-layout.') or n in ['.git','.DS_Store','artefato.manifest.json','REGRAS-DO-PROJETO.md'] or n.endswith(('.pyc','.log')):continue
  if not (rel.startswith(('core/','app/','skills/','docs/')) or rel in ['package.json','migrar-layout.mjs','.gitignore','LICENSE'] or rel.endswith('.md') and '/' not in rel):continue
  if rel.startswith('core/config/') and not rel.startswith('core/config/modelos/') and rel!='core/config/compat-153.json':continue
  if rel.startswith('skills/adapt-resume/') and mod['protected'](rel):continue
  if n.startswith('.env'):continue
  b=a.read_bytes();entries.append({'nome':rel,'sha256':hashlib.sha256(b).hexdigest(),'modo':0o755 if a.stat().st_mode&0o111 else 0o644,'conteudo':base64.b64encode(b).decode()})
entries.sort(key=lambda e:e['nome'])
payload={'contrato':1,'versao':json.loads((src/'core/package.json').read_text())['version'],'modelos':json.loads((src/'core/config/modelos/mapa.json').read_text()),'arquivos':entries,'anteriores':[{'nome':e['nome'],'sha256':hashlib.sha256(base64.b64decode(e['conteudo'])).hexdigest()} for e in mod['baseline'](src)],'legados':[{'nome':n,'sha256':hashlib.sha256(b).hexdigest()} for n,b in sorted(legacy.items())]}
raw=json.dumps(payload,separators=(',',':'),ensure_ascii=False).encode();digest=hashlib.sha256(raw).hexdigest()
# Mesmo payload no Git e no ZIP. Geração nunca usa config/dados pessoais como modelos.
for n,b in [('conteudo.json',raw),('conteudo.sha256',(digest+'\n').encode())]:
 q=src/'vagas/src/compat-layout'/n
 if preparar:q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b)
 elif not q.exists() or q.read_bytes()!=b:raise SystemExit('PONTE_FONTE_DIVERGENTE: prepare o payload da candidata antes de empacotar.')
 legacy['vagas/src/compat-layout/'+n]=b
legacy['vagas/src/compat-layout/bootstrap.mjs']=(src/'vagas/src/compat-layout/bootstrap.mjs').read_bytes()
dest.mkdir(parents=True,exist_ok=False);manifest=[]
for n,b in sorted(legacy.items()):
 # Metadados ignorados pelo instalador1.5.3 podem permanecer; nenhum path novo foraallowlist.
 q=dest/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b);manifest.append({'path':n,'sha256':hashlib.sha256(b).hexdigest(),'mode':'0o644'})
# Manifesto da distribuição acompanha o payload, não um caminho raiz recusado pelo1.5.3.
q=dest/'vagas/src/compat-layout/distribuicao.json';q.write_text(json.dumps({'contrato':1,'payloadSha256':digest,'arquivos':manifest},indent=2)+'\n');
if preparar:shutil.copy2(q,src/'vagas/src/compat-layout/distribuicao.json')
print(len(manifest),'arquivos externos; payload',len(entries),'arquivos canônicos;',len(raw),'bytes')
if len(sys.argv)>3:
 archive=Path(sys.argv[3])
 if archive.exists():raise SystemExit('ZIP já existe; nada será sobrescrito.')
 with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED) as z:
  for p in sorted(dest.rglob('*')):
   if p.is_file():
    info=zipfile.ZipInfo('jobrelay/'+p.relative_to(dest).as_posix(),date_time=(1980,1,1,0,0,0));info.create_system=3;info.external_attr=(0o100644<<16);info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
