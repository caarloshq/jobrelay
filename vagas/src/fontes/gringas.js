// Fachada transitória gerada; fonte canônica: core/src/fontes/gringas.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/gringas.js");
const modulo=await import(pathToFileURL(alvo).href);
export const NOME=modulo.NOME;
export const coletar=modulo.coletar;
export const coletarDe=modulo.coletarDe;
export const expandirConsultas=modulo.expandirConsultas;
export const paraVaga=modulo.paraVaga;
export const partesDoLocal=modulo.partesDoLocal;
