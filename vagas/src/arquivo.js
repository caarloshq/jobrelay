// Fachada transitória gerada; fonte canônica: core/src/arquivo.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/arquivo.js");
const modulo=await import(pathToFileURL(alvo).href);
export const CONCLUIDOS=modulo.CONCLUIDOS;
export const aplicar=modulo.aplicar;
export const carregar=modulo.carregar;
export const carregarOperacional=modulo.carregarOperacional;
export const concluidaOperacional=modulo.concluidaOperacional;
export const espelhar=modulo.espelhar;
export const mesclar=modulo.mesclar;
export const resumo=modulo.resumo;
