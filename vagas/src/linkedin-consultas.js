// Fachada transitória gerada; fonte canônica: core/src/linkedin-consultas.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/linkedin-consultas.js");
const modulo=await import(pathToFileURL(alvo).href);
export const conferirConsultaLinkedin=modulo.conferirConsultaLinkedin;
export const planejarConsultasLinkedin=modulo.planejarConsultasLinkedin;
