// Fachada transitória gerada; fonte canônica: core/src/fontes-respostas.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes-respostas.js");
const modulo=await import(pathToFileURL(alvo).href);
export const atualizarPerfilCampo=modulo.atualizarPerfilCampo;
export const classificarPergunta=modulo.classificarPergunta;
export const lerFontes=modulo.lerFontes;
export const renderizarFontes=modulo.renderizarFontes;
