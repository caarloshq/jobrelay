// Fachada transitória gerada; fonte canônica: core/src/salario.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/salario.js");
const modulo=await import(pathToFileURL(alvo).href);
export const daFonte=modulo.daFonte;
export const doTexto=modulo.doTexto;
export const formatar=modulo.formatar;
export const lerPeriodo=modulo.lerPeriodo;
export const mensalBRL=modulo.mensalBRL;
export const paraNumero=modulo.paraNumero;
export const resolver=modulo.resolver;
