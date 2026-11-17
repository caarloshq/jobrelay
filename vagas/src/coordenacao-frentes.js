// Fachada transitória gerada; fonte canônica: core/src/coordenacao-frentes.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/coordenacao-frentes.js");
const modulo=await import(pathToFileURL(alvo).href);
export const CoordenadorFrentes=modulo.CoordenadorFrentes;
export const FRENTES=modulo.FRENTES;
export const PERGUNTA_COLETA2=modulo.PERGUNTA_COLETA2;
export const executarFrentes=modulo.executarFrentes;
export const normalizarFrentes=modulo.normalizarFrentes;
export const planejarFrentes=modulo.planejarFrentes;
