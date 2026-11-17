// Fachada transitória gerada; fonte canônica: core/src/dedupe.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/dedupe.js");
const modulo=await import(pathToFileURL(alvo).href);
export const chaveAnuncio=modulo.chaveAnuncio;
export const chaveRequisicao=modulo.chaveRequisicao;
export const idCanonico=modulo.idCanonico;
export const juntar=modulo.juntar;
export const prioridade=modulo.prioridade;
export const reconciliarCache=modulo.reconciliarCache;
export const requisicaoDoTitulo=modulo.requisicaoDoTitulo;
export const requisicoesConflitam=modulo.requisicoesConflitam;
export const tituloComparavel=modulo.tituloComparavel;
