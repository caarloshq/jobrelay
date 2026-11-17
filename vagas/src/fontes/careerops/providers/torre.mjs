// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/torre.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/torre.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const buildTorreQuery=modulo.buildTorreQuery;
export const normalizeTorreOpportunity=modulo.normalizeTorreOpportunity;
export default modulo.default;
