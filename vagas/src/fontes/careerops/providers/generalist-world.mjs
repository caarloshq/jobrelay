// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/generalist-world.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/generalist-world.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const normalizeGeneralistWorldCard=modulo.normalizeGeneralistWorldCard;
export const parseGeneralistWorldJobs=modulo.parseGeneralistWorldJobs;
export const resolveGeneralistWorldUrl=modulo.resolveGeneralistWorldUrl;
export default modulo.default;
