// Fachada transitória gerada; fonte canônica: core/src/senioridade.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/senioridade.js");
const modulo=await import(pathToFileURL(alvo).href);
export const detectar=modulo.detectar;
export const ehInternacional=modulo.ehInternacional;
export const pontos=modulo.pontos;
