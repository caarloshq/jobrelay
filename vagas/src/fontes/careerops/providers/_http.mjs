// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/_http.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/_http.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const BROWSER_LIKE_USER_AGENT=modulo.BROWSER_LIKE_USER_AGENT;
export const MACOS_BROWSER_LIKE_USER_AGENT=modulo.MACOS_BROWSER_LIKE_USER_AGENT;
export const fetchJson=modulo.fetchJson;
export const fetchJsonWithRetry=modulo.fetchJsonWithRetry;
export const fetchResponse=modulo.fetchResponse;
export const fetchText=modulo.fetchText;
export const fetchTextHead=modulo.fetchTextHead;
export const fetchTextWithRetry=modulo.fetchTextWithRetry;
export const isRefusedRedirectError=modulo.isRefusedRedirectError;
export const isRetryableError=modulo.isRetryableError;
export const makeHttpCtx=modulo.makeHttpCtx;
export const parseRetryAfterMs=modulo.parseRetryAfterMs;
export const sleep=modulo.sleep;
