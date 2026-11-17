// Fachada transitória gerada; fonte canônica: core/src/atualizacao.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/atualizacao.js");
const modulo=await import(pathToFileURL(alvo).href);
export const atualizarAutomaticamente=modulo.atualizarAutomaticamente;
export const lerConfirmacao=modulo.lerConfirmacao;
export const podeIniciarOperacao=modulo.podeIniciarOperacao;
