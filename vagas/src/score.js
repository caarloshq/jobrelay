// Fachada transitória gerada; fonte canônica: core/src/score.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/score.js");
const modulo=await import(pathToFileURL(alvo).href);
export const calcular=modulo.calcular;
export const compatibilidade=modulo.compatibilidade;
export const exigenciaIngles=modulo.exigenciaIngles;
export const faixa=modulo.faixa;
export const pontosDominio=modulo.pontosDominio;
export const pontosSinais=modulo.pontosSinais;
export const pontosTitulo=modulo.pontosTitulo;
