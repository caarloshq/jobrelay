import fs from 'node:fs';
import path from 'node:path';
export function layout(raiz) {
 const nova=fs.existsSync(path.join(raiz,'core/package.json'));
 return { raiz, onboarding:path.join(raiz,nova?'app/onboarding':'onboarding'), quadro:path.join(raiz,nova?'app/quadro':'quadro'), env:path.join(raiz,nova?'local/.env':'vagas/.env'), core:path.join(raiz,nova?'core':'vagas'), dados:path.join(raiz,nova?'local/data':'vagas/data'), config:path.join(raiz,nova?'local/config':'vagas/config'), aplicacao:path.join(raiz,nova?'local/aplicacao':'aplicacao'), skills:path.join(raiz,nova?'skills':'Skills'), app:path.join(raiz,nova?'app':'interface') };
}
