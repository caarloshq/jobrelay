// Fachada transitória gerada; fonte canônica: core/src/busca/ddg.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/busca/ddg.js");
const modulo=await import(pathToFileURL(alvo).href);
export const cabeNoBuscador=modulo.cabeNoBuscador;
export const coletar=modulo.coletar;
export const estaBloqueado=modulo.estaBloqueado;
export const lerResultados=modulo.lerResultados;
export const montarConsultas=modulo.montarConsultas;
