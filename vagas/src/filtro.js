// Fachada transitória gerada; fonte canônica: core/src/filtro.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/filtro.js");
const modulo=await import(pathToFileURL(alvo).href);
export const avaliar=modulo.avaliar;
export const avaliarLocal=modulo.avaliarLocal;
export const pistasDaDescricao=modulo.pistasDaDescricao;
export const pistasDoTitulo=modulo.pistasDoTitulo;
