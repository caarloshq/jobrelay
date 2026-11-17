// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/builtin.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/builtin.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const composeLocation=modulo.composeLocation;
export const parseCards=modulo.parseCards;
export const parseListPage=modulo.parseListPage;
export const parsePostedAt=modulo.parsePostedAt;
export const parseSalary=modulo.parseSalary;
export const readConfig=modulo.readConfig;
export const resolveHost=modulo.resolveHost;
export default modulo.default;
