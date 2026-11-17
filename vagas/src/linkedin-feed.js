// Fachada transitória gerada; fonte canônica: core/src/linkedin-feed.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/linkedin-feed.js");
const modulo=await import(pathToFileURL(alvo).href);
export const prepararLote=modulo.prepararLote;
export const validarDesfecho=modulo.validarDesfecho;
