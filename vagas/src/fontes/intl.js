// Fachada transitória gerada; fonte canônica: core/src/fontes/intl.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/intl.js");
const modulo=await import(pathToFileURL(alvo).href);
export const avaliarElegibilidade=modulo.avaliarElegibilidade;
export const citaLatamNoTexto=modulo.citaLatamNoTexto;
export const elegivelLatam=modulo.elegivelLatam;
