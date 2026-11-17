// Fachada transitória gerada; fonte canônica: core/src/fontes/portais.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/portais.js");
const modulo=await import(pathToFileURL(alvo).href);
export const NOME=modulo.NOME;
export const PORTAIS=modulo.PORTAIS;
export const coletar=modulo.coletar;
export const coletarDe=modulo.coletarDe;
export const lerPagina=modulo.lerPagina;
export const linkDaVaga=modulo.linkDaVaga;
