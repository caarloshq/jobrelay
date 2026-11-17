// Fachada transitória gerada; fonte canônica: core/src/rodada-lote.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/rodada-lote.js");
const modulo=await import(pathToFileURL(alvo).href);
export const linhaProgressoAplicacao=modulo.linhaProgressoAplicacao;
export const operarLote=modulo.operarLote;
export const planejarLote=modulo.planejarLote;
export const politicaMelhorias=modulo.politicaMelhorias;
export const resumoAplicacao=modulo.resumoAplicacao;
export const resumoColeta=modulo.resumoColeta;
export const resumoColeta2Fora=modulo.resumoColeta2Fora;
export const resumoRodada=modulo.resumoRodada;
