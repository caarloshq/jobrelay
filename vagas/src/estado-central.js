// Fachada transitória gerada; fonte canônica: core/src/estado-central.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/estado-central.js");
const modulo=await import(pathToFileURL(alvo).href);
export const copiarEstado=modulo.copiarEstado;
export const herdarVersao=modulo.herdarVersao;
export const lerEstado=modulo.lerEstado;
export const salvarEstado=modulo.salvarEstado;
