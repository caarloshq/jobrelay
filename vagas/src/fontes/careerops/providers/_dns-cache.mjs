// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/_dns-cache.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/_dns-cache.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const RESOLVER_FAILURE_CODES=modulo.RESOLVER_FAILURE_CODES;
export const createCachedLookup=modulo.createCachedLookup;
export const createTokenBucket=modulo.createTokenBucket;
export const dnsPacingStats=modulo.dnsPacingStats;
export const isResolverFailure=modulo.isResolverFailure;
export const lookupsPerMinFromEnv=modulo.lookupsPerMinFromEnv;
