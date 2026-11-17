// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/jobvite.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/jobvite.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const extractEidFromBoard=modulo.extractEidFromBoard;
export const parseJobviteXml=modulo.parseJobviteXml;
export const resolveConfiguredEid=modulo.resolveConfiguredEid;
export const resolveSlug=modulo.resolveSlug;
export default modulo.default;
