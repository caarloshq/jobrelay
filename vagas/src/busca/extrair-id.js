// Fachada transitória gerada; fonte canônica: core/src/busca/extrair-id.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/busca/extrair-id.js");
const modulo=await import(pathToFileURL(alvo).href);
export const deBase64=modulo.deBase64;
export const extrair=modulo.extrair;
