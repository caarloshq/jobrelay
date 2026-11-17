// Fachada transitória gerada; fonte canônica: core/src/fonte-respostas.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fonte-respostas.js");
const modulo=await import(pathToFileURL(alvo).href);
export const confirmarRespostaSincronizada=modulo.confirmarRespostaSincronizada;
export const estadoSincroniaRespostas=modulo.estadoSincroniaRespostas;
export const lerFonteRespostas=modulo.lerFonteRespostas;
export const marcarPendenciaResposta=modulo.marcarPendenciaResposta;
export const selecionarFonteRespostas=modulo.selecionarFonteRespostas;
