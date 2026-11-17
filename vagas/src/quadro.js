// Fachada transitória gerada; fonte canônica: core/src/quadro.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/quadro.js");
const modulo=await import(pathToFileURL(alvo).href);
export const ARQ=modulo.ARQ;
export const STATUS=modulo.STATUS;
export const STATUS_EXTRA=modulo.STATUS_EXTRA;
export const STATUS_INICIAL=modulo.STATUS_INICIAL;
export const carregar=modulo.carregar;
export const contarPorStatus=modulo.contarPorStatus;
export const fazerBackup=modulo.fazerBackup;
export const mover=modulo.mover;
export const registrar=modulo.registrar;
export const salvar=modulo.salvar;
