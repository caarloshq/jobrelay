// Fachada transitória gerada; fonte canônica: core/src/config.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/config.js");
const modulo=await import(pathToFileURL(alvo).href);
export const DIR_CONFIG=modulo.DIR_CONFIG;
export const DIR_DADOS=modulo.DIR_DADOS;
export const RAIZ=modulo.RAIZ;
export const dorks=modulo.dorks;
export const linkedin=modulo.linkedin;
export const palavras=modulo.palavras;
export const perfil=modulo.perfil;
