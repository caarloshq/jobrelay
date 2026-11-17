// Fachada transitória gerada; fonte canônica: core/tests/fontes-respostas.test.js
import {bootstrap} from "../src/compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/tests/fontes-respostas.test.js");
const modulo=await import(pathToFileURL(alvo).href);
