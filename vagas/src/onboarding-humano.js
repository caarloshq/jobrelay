// Fachada transitória gerada; fonte canônica: core/src/onboarding-humano.js
import {bootstrap} from "./compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/onboarding-humano.js");
const modulo=await import(pathToFileURL(alvo).href);
export const MENSAGEM=modulo.MENSAGEM;
export const concluido=modulo.concluido;
export const criarSessaoFormulario=modulo.criarSessaoFormulario;
export const exigirOnboardingHumano=modulo.exigirOnboardingHumano;
