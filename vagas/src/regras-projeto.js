// Fachada transitória gerada; fonte canônica: core/src/regras-projeto.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/regras-projeto.js");
const modulo=await import(pathToFileURL(alvo).href);
export const MODELO_REGRAS=modulo.MODELO_REGRAS;
export const iniciarRegras=modulo.iniciarRegras;
export const lerRegras=modulo.lerRegras;
export const registrarRegra=modulo.registrarRegra;
