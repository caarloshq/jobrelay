// Fachada transitória gerada; fonte canônica: core/src/fontes/vagasremotas.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/vagasremotas.js");
const modulo=await import(pathToFileURL(alvo).href);
export const NOME=modulo.NOME;
export const coletar=modulo.coletar;
export const lerDetalhe=modulo.lerDetalhe;
export const lerRss=modulo.lerRss;
export const pagaEmDolar=modulo.pagaEmDolar;
