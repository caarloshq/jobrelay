// Fachada transitória gerada; fonte canônica: core/src/semantico.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/semantico.js");
const modulo=await import(pathToFileURL(alvo).href);
export const aplicar=modulo.aplicar;
export const carregar=modulo.carregar;
export const impressao=modulo.impressao;
export const julgamentoDe=modulo.julgamentoDe;
export const migrarChaves=modulo.migrarChaves;
export const registrar=modulo.registrar;
export const salvar=modulo.salvar;
