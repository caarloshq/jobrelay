// Fachada transitória gerada; fonte canônica: core/src/persistencia.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/persistencia.js");
const modulo=await import(pathToFileURL(alvo).href);
export const gravarJsonAtomico=modulo.gravarJsonAtomico;
export const gravarTextoAtomico=modulo.gravarTextoAtomico;
export const lerJsonComHash=modulo.lerJsonComHash;
export const lerJsonSeguro=modulo.lerJsonSeguro;
export const lerTextoComHash=modulo.lerTextoComHash;
export const nlinkTolerado=modulo.nlinkTolerado;
