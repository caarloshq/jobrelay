// Fachada transitória gerada; fonte canônica: core/scripts/registrar-respostas.mjs
import {bootstrap} from "../src/compat-layout/bootstrap.mjs";
import {fileURLToPath,pathToFileURL} from 'node:url';import path from 'node:path';
const raiz=fileURLToPath(new URL("../../",import.meta.url));await bootstrap(raiz);
const alvo=path.join(raiz,"core/scripts/registrar-respostas.mjs");
process.argv[1]=alvo;await import(pathToFileURL(alvo).href);
