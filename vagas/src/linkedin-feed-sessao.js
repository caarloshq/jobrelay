// Fachada transitória gerada; fonte canônica: core/src/linkedin-feed-sessao.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/linkedin-feed-sessao.js");
const modulo=await import(pathToFileURL(alvo).href);
export const ABANDONO_LOTE_MS=modulo.ABANDONO_LOTE_MS;
export const META_SEGUNDOS=modulo.META_SEGUNDOS;
export const ROTAS_CAPTURA=modulo.ROTAS_CAPTURA;
export const consultar=modulo.consultar;
export const executar=modulo.executar;
export const planejar=modulo.planejar;
