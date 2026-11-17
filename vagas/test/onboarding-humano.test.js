// Fachada transitória gerada; fonte canônica: core/tests/onboarding-humano.test.js
import {bootstrap} from "../src/compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/tests/onboarding-humano.test.js");
const modulo=await import(pathToFileURL(alvo).href);
export const DIR_DADOS=modulo.DIR_DADOS;
export const VERSAO=modulo.VERSAO;
export const atualizarAutomaticamente=modulo.atualizarAutomaticamente;
export const lerPolitica=modulo.lerPolitica;
export const perfil=modulo.perfil;
export const podeIniciarOperacao=modulo.podeIniciarOperacao;
