// Fachada transitória gerada; fonte canônica: core/src/fontes/arc.js
import {bootstrap} from "../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/arc.js");
const modulo=await import(pathToFileURL(alvo).href);
export const NOME=modulo.NOME;
export const ROTAS=modulo.ROTAS;
export const aceitaBrasil=modulo.aceitaBrasil;
export const coletar=modulo.coletar;
export const estaAberta=modulo.estaAberta;
export const lerArcJobs=modulo.lerArcJobs;
export const lerNextData=modulo.lerNextData;
export const limparMarkdown=modulo.limparMarkdown;
export const montarSalario=modulo.montarSalario;
export const paraIso=modulo.paraIso;
export const paraVaga=modulo.paraVaga;
export const urlPublica=modulo.urlPublica;
