// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/hackernews.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/hackernews.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const parseHnComment=modulo.parseHnComment;
export const resolveLatestThreadId=modulo.resolveLatestThreadId;
export default modulo.default;
