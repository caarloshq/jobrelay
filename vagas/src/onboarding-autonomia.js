// Fachada transitória gerada; fonte canônica: core/src/onboarding-autonomia.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/onboarding-autonomia.js");
const modulo=await import(pathToFileURL(alvo).href);
export const POLITICA_PADRAO=modulo.POLITICA_PADRAO;
export const instrucaoOnboarding=modulo.instrucaoOnboarding;
export const lerLinkedinFeed=modulo.lerLinkedinFeed;
export const lerPolitica=modulo.lerPolitica;
export const normalizarEscolhas=modulo.normalizarEscolhas;
export const salvarLinkedinFeed=modulo.salvarLinkedinFeed;
export const salvarPolitica=modulo.salvarPolitica;
