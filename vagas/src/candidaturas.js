// Fachada transitória gerada; fonte canônica: core/src/candidaturas.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/candidaturas.js");
const modulo=await import(pathToFileURL(alvo).href);
export const atualizar=modulo.atualizar;
export const carregar=modulo.carregar;
export const salvar=modulo.salvar;
