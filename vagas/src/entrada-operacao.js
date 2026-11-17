// Fachada transitória gerada; fonte canônica: core/src/entrada-operacao.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/entrada-operacao.js");
const modulo=await import(pathToFileURL(alvo).href);
export const entrarEscritor=modulo.entrarEscritor;
