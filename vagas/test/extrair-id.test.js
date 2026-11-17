// Fachada transitória gerada; fonte canônica: core/tests/extrair-id.test.js
import {bootstrap} from "../src/compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/tests/extrair-id.test.js");
const modulo=await import(pathToFileURL(alvo).href);
