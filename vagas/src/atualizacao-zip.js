// Fachada transitória gerada; fonte canônica: core/src/atualizacao-zip.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/atualizacao-zip.js");
const modulo=await import(pathToFileURL(alvo).href);
export const MAX_ZIP=modulo.MAX_ZIP;
export const baixarZip=modulo.baixarZip;
export const instalarZip=modulo.instalarZip;
export const lerZip=modulo.lerZip;
export const permitidoZip=modulo.permitidoZip;
