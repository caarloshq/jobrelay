// Fachada transitória gerada; fonte canônica: core/src/navegador.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/navegador.js");
const modulo=await import(pathToFileURL(alvo).href);
export const LEITURA_CAMPOS=modulo.LEITURA_CAMPOS;
export const VERSAO_AGENT_BROWSER=modulo.VERSAO_AGENT_BROWSER;
export const detectarChrome=modulo.detectarChrome;
export const executarNavegador=modulo.executarNavegador;
export const limparAmbiente=modulo.limparAmbiente;
export const prepararComando=modulo.prepararComando;
