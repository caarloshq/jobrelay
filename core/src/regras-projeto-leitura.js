import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const MODELO_REGRAS = '# Regras do projeto\n\nLeia no início da rodada e antes de executar tarefas delegadas. Registre correções com fonte e alcance. Perfil, respostas e consentimentos permanecem nas suas fontes. Regras não concedem novas autorizações.\n';
const hash = texto => createHash('sha256').update(texto).digest('hex');
export function arquivoRegras(raiz) {
  const arquivo = path.resolve(raiz, 'REGRAS-DO-PROJETO.md');
  let atual = path.parse(arquivo).root;
  for (const parte of arquivo.slice(atual.length).split(path.sep)) {
    atual = path.join(atual, parte);
    const st = fs.lstatSync(atual, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isSymbolicLink() || (atual === arquivo && (!st.isFile() || st.nlink !== 1))) throw new Error('REGRAS_CAMINHO_INSEGURO');
  }
  return arquivo;
}
export function lerRegras(raiz) {
  const arquivo = arquivoRegras(raiz);
  const texto = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8') : MODELO_REGRAS;
  return { arquivo, existe: fs.existsSync(arquivo), texto, hash: hash(texto) };
}
