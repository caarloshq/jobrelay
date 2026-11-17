// Fachada transitória gerada; fonte canônica: core/src/materiais-onboarding.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/materiais-onboarding.js");
const modulo=await import(pathToFileURL(alvo).href);
export const MAX_ARQUIVO=modulo.MAX_ARQUIVO;
export const TIPOS_MATERIAIS=modulo.TIPOS_MATERIAIS;
export const textoDocx=modulo.textoDocx;
export const validarMaterial=modulo.validarMaterial;
