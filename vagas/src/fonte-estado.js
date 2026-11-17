// Fachada transitória gerada; fonte canônica: core/src/fonte-estado.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fonte-estado.js");
const modulo=await import(pathToFileURL(alvo).href);
export const carregarFonte=modulo.carregarFonte;
export const configuracao=modulo.configuracao;
export const exigirLocal=modulo.exigirLocal;
export const importar=modulo.importar;
export const normalizarSnapshot=modulo.normalizarSnapshot;
export const selecionar=modulo.selecionar;
