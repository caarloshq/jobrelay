// Fachada transitória gerada; fonte canônica: core/src/operacao.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/operacao.js");
const modulo=await import(pathToFileURL(alvo).href);
export const LIMITES_ORFA=modulo.LIMITES_ORFA;
export const _dependencias=modulo._dependencias;
export const comEscritaCentral=modulo.comEscritaCentral;
export const consultarOperacao=modulo.consultarOperacao;
export const diagnosticarOperacaoOrfa=modulo.diagnosticarOperacaoOrfa;
export const operar=modulo.operar;
export const validarEnvio=modulo.validarEnvio;
