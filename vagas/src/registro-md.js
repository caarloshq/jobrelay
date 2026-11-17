// Fachada transitória gerada; fonte canônica: core/src/registro-md.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/registro-md.js");
const modulo=await import(pathToFileURL(alvo).href);
export const PONTEIRO_HISTORICO=modulo.PONTEIRO_HISTORICO;
export const migrarHistorico=modulo.migrarHistorico;
export const raizDoProjeto=modulo.raizDoProjeto;
export const registrarRespostas=modulo.registrarRespostas;
