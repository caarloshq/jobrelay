// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/personio.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/personio.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const parsePersonioHtml=modulo.parsePersonioHtml;
export const parsePersonioXml=modulo.parsePersonioXml;
export default modulo.default;
