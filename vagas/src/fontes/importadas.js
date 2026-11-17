// Fachada transitória gerada; fonte canônica: core/src/fontes/importadas.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/importadas.js");
const modulo=await import(pathToFileURL(alvo).href);
export const NOME=modulo.NOME;
export const coletar=modulo.coletar;
export const coletarDe=modulo.coletarDe;
export const normalizar=modulo.normalizar;
export const urlPublica=modulo.urlPublica;
