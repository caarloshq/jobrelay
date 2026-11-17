// Fachada transitória gerada; fonte canônica: core/src/liveness.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/liveness.js");
const modulo=await import(pathToFileURL(alvo).href);
export const estaViva=modulo.estaViva;
export const lerData=modulo.lerData;
export const lerStatus=modulo.lerStatus;
export const lerTitulo=modulo.lerTitulo;
export const validar=modulo.validar;
export const validarLista=modulo.validarLista;
