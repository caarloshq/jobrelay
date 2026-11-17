from pathlib import Path
import os,shutil,json,hashlib,sys,zipfile
src=Path(sys.argv[1]).resolve();dest=Path(sys.argv[2]).resolve();
if dest == src or src in dest.parents: raise SystemExit('Origem e destino precisam ser árvores separadas.')
dest.mkdir(parents=True,exist_ok=False);nomes=[]
for base,ds,fs in os.walk(src,followlinks=False):
 ds[:]=[d for d in ds if d not in ['node_modules','.git','local','__pycache__','.astro','dist','.migracao-layout.lock'] and not (Path(base)/d).is_symlink()]
 for n in fs:
  a=Path(base)/n;rel=a.relative_to(src)
  if rel.as_posix() == 'REGRAS-DO-PROJETO.md' or (rel.parts[:2] == ('core','config') and (len(rel.parts)<3 or rel.parts[2]!='modelos')):continue
  if n == 'artefato.manifest.json':continue
  if n.startswith('.env') and n != '.env.example':continue
  if a.is_symlink() or n.endswith(('.pyc','.log')) or n in ['.DS_Store']:continue
  b=dest/rel;b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(a,b);nomes.append({'path':rel.as_posix(),'sha256':hashlib.sha256(b.read_bytes()).hexdigest(),'mode':oct(b.stat().st_mode&0o777)})
(dest/'artefato.manifest.json').write_text(json.dumps({'versao':1,'arquivos':nomes},indent=2)+'\n')
print(len(nomes),'arquivos; nenhum link/local/dependência')

if len(sys.argv)>3:
    arquivo=Path(sys.argv[3])
    if arquivo.exists(): raise SystemExit('ZIP já existe; nada será sobrescrito.')
    with zipfile.ZipFile(arquivo,'x',zipfile.ZIP_DEFLATED) as pacote:
        for item in sorted(dest.rglob('*')):
            if item.is_file(): pacote.write(item,'jobrelay/'+item.relative_to(dest).as_posix())
