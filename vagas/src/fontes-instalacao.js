// Fachada transitória gerada; fonte canônica: core/src/fontes-instalacao.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes-instalacao.js");
const modulo=await import(pathToFileURL(alvo).href);
export const atualizarPerfilInstalacao=modulo.atualizarPerfilInstalacao;
export const importarLegado=modulo.importarLegado;
export const lerFontesInstalacao=modulo.lerFontesInstalacao;
