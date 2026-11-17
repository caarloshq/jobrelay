// Fachada transitória gerada; fonte canônica: core/src/fontes/uxjobs.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/uxjobs.js");
const modulo=await import(pathToFileURL(alvo).href);
export const NOME=modulo.NOME;
export const aceitaBrasil=modulo.aceitaBrasil;
export const coletar=modulo.coletar;
export const descricaoDaOrigem=modulo.descricaoDaOrigem;
export const lerDetalhe=modulo.lerDetalhe;
export const lerIndice=modulo.lerIndice;
export const paraVaga=modulo.paraVaga;
export const tituloLimpo=modulo.tituloLimpo;
