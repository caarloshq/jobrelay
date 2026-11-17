// Fachada transitória gerada; fonte canônica: core/src/frescor.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/frescor.js");
const modulo=await import(pathToFileURL(alvo).href);
export const ROTULO=modulo.ROTULO;
export const dataEfetiva=modulo.dataEfetiva;
export const idadeEmDias=modulo.idadeEmDias;
export const janela=modulo.janela;
export const pontosFrescor=modulo.pontosFrescor;
