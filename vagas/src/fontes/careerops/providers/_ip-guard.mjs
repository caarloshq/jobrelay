// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/_ip-guard.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/_ip-guard.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const blockedAddressError=modulo.blockedAddressError;
export const inProviderFetch=modulo.inProviderFetch;
export const isBlockedAddress=modulo.isBlockedAddress;
export const providerFetchContext=modulo.providerFetchContext;
