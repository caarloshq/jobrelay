// Fachada transitória gerada; fonte canônica: core/src/navegador-controle.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/navegador-controle.js");
const modulo=await import(pathToFileURL(alvo).href);
export const adquirirTravaComando=modulo.adquirirTravaComando;
export const argumentosSemLancamento=modulo.argumentosSemLancamento;
export const endpointDoPerfil=modulo.endpointDoPerfil;
export const executarProtegido=modulo.executarProtegido;
export const exigirSemAtualizacao=modulo.exigirSemAtualizacao;
export const inventarioSeguro=modulo.inventarioSeguro;
export const lerTargets=modulo.lerTargets;
export const lifecycleSeguro=modulo.lifecycleSeguro;
export const processosDaInstalacao=modulo.processosDaInstalacao;
export const transporteAtual=modulo.transporteAtual;
export const urlCheckpoint=modulo.urlCheckpoint;
