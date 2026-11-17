// Fachada transitória gerada; fonte canônica: core/src/fontes/careerops/providers/workday.mjs
import {bootstrap} from "../../../compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../../../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/src/fontes/careerops/providers/workday.mjs");
const modulo=await import(pathToFileURL(alvo).href);
export const chooseSplitFacet=modulo.chooseSplitFacet;
export const isMultiLocationPlaceholder=modulo.isMultiLocationPlaceholder;
export const locationsFromDetail=modulo.locationsFromDetail;
export const pageIsPastWindow=modulo.pageIsPastWindow;
export const parseWorkdayResponse=modulo.parseWorkdayResponse;
export const postedAtFromDetail=modulo.postedAtFromDetail;
export const trueTotalFromFacets=modulo.trueTotalFromFacets;
export const workdayDedupKey=modulo.workdayDedupKey;
export default modulo.default;
