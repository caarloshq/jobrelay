// Fachada transitória gerada; fonte canônica: core/src/linkedin-feed-entrada.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/linkedin-feed-entrada.js");
const modulo=await import(pathToFileURL(alvo).href);
export const entradaFeed=modulo.entradaFeed;
