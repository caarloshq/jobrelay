// Fachada transitória gerada; fonte canônica: core/src/fontes/vagasux.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/vagasux.js");
const modulo=await import(pathToFileURL(alvo).href);
export const NOME=modulo.NOME;
export const PAGINAS=modulo.PAGINAS;
export const coletar=modulo.coletar;
export const lerData=modulo.lerData;
export const lerDetalhe=modulo.lerDetalhe;
export const lerItens=modulo.lerItens;
