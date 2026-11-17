// Fachada transitória gerada; fonte canônica: core/src/instrucao.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/instrucao.js");
const modulo=await import(pathToFileURL(alvo).href);
export const DIR_ADAPT=modulo.DIR_ADAPT;
export const DIR_BUILDS=modulo.DIR_BUILDS;
export const baldesAcionados=modulo.baldesAcionados;
export const carregarBaseContent=modulo.carregarBaseContent;
export const escrever=modulo.escrever;
export const gerar=modulo.gerar;
export const jaExiste=modulo.jaExiste;
export const realceDeBaldes=modulo.realceDeBaldes;
export const slug=modulo.slug;
