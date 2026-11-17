// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/user-agent.mjs
import {bootstrap} from "../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/user-agent.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const BROWSER_LIKE_USER_AGENT=modulo.BROWSER_LIKE_USER_AGENT;
export const DEFAULT_USER_AGENT=modulo.DEFAULT_USER_AGENT;
export const MACOS_BROWSER_LIKE_USER_AGENT=modulo.MACOS_BROWSER_LIKE_USER_AGENT;
