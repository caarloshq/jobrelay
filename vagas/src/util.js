// Fachada transitória gerada; fonte canônica: core/src/util.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/util.js");
const modulo=await import(pathToFileURL(alvo).href);
export const DIACRITICOS=modulo.DIACRITICOS;
export const UA=modulo.UA;
export const buscar=modulo.buscar;
export const casaAlgum=modulo.casaAlgum;
export const casaTermo=modulo.casaTermo;
export const dormir=modulo.dormir;
export const hoje=modulo.hoje;
export const limparHtml=modulo.limparHtml;
export const normalizarLink=modulo.normalizarLink;
export const normalizarTexto=modulo.normalizarTexto;
export const novoContador=modulo.novoContador;
