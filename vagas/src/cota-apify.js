// Fachada transitória gerada; fonte canônica: core/src/cota-apify.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/cota-apify.js");
const modulo=await import(pathToFileURL(alvo).href);
export const confirmarDisparo=modulo.confirmarDisparo;
export const consultarCota=modulo.consultarCota;
export const diaDaInstalacao=modulo.diaDaInstalacao;
export const registrarUsoExistente=modulo.registrarUsoExistente;
export const reservarDisparo=modulo.reservarDisparo;
