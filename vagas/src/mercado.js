// Fachada transitória gerada; fonte canônica: core/src/mercado.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/mercado.js");
const modulo=await import(pathToFileURL(alvo).href);
export const FOCOS=modulo.FOCOS;
export const FONTES_AMBOS=modulo.FONTES_AMBOS;
export const FONTES_INTERNACIONAIS=modulo.FONTES_INTERNACIONAIS;
export const FONTES_NACIONAIS=modulo.FONTES_NACIONAIS;
export const descontoMercado=modulo.descontoMercado;
export const fontesAtivas=modulo.fontesAtivas;
export const idiomaDoCurriculo=modulo.idiomaDoCurriculo;
export const validar=modulo.validar;
