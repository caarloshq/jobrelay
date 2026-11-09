import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { atualizarPerfilCampo, lerFontes, renderizarFontes } from './fontes-respostas.js';
import { comEscritaCentral } from './operacao.js';

const PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MODELOS = Object.freeze({
  respostas: 'af0c0336d51f53a9759f6f58d1c6f83c3e6d3b08f0c72a56d027e3ba09d8a573',
  perfil: 'd45db3d7cf7bc146ec3022790ff1ae46e95f30fa93cb7763c4057957e7e44a99',
});
const DADOS_NEUTROS = Object.freeze({
  banco: '7f2382cce998355f062cdb182d9b9579d9c7eb0d1f482c7775e027b298db10d7',
  perfil: 'f786aefe3897258c5d20e7f530b30bed50f90be0b044f01d0795fa43494e61aa',
});
const hash = (texto) => crypto.createHash('sha256').update(texto).digest('hex');
const existe = (arquivo) => fs.existsSync(arquivo);

function caminhos(raizProjeto = PROJETO) {
  const raiz = path.resolve(raizProjeto);
  return {
    respostas: path.join(raiz, 'aplicacao', 'RESPOSTAS.md'),
    perfil: path.join(raiz, 'aplicacao', 'PERFIL.md'),
    bancoJson: path.join(raiz, 'vagas', 'data', 'perguntas.json'),
    perfilJson: path.join(raiz, 'vagas', 'config', 'perfil-candidatura.json'),
    trava: path.join(raiz, 'aplicacao', '.fontes.lock'),
  };
}

function lerArquivo(arquivo) {
  const info = fs.lstatSync(arquivo);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) {
    throw new Error('FONTE_INSEGURA: arquivo de respostas precisa ser regular');
  }
  return fs.readFileSync(arquivo, 'utf8');
}

function legado(c) {
  return {
    banco: JSON.parse(lerArquivo(c.bancoJson)),
    perfil: JSON.parse(lerArquivo(c.perfilJson)),
  };
}

function ambosOuNenhum(c) {
  const r = existe(c.respostas), p = existe(c.perfil);
  if (r !== p) throw new Error('FONTES_INCOMPLETAS: RESPOSTAS.md e PERFIL.md devem existir juntos');
  return r;
}

function comTrava(c, acao) {
  const fd = fs.openSync(c.trava, 'wx', 0o600);
  try { return acao(); }
  finally { fs.closeSync(fd); fs.unlinkSync(c.trava); }
}

function gravarAtomico(arquivo, texto, esperado = null) {
  const atual = existe(arquivo) ? lerArquivo(arquivo) : null;
  if (atual !== esperado) throw new Error('CONFLITO_FONTES: Markdown mudou durante a gravação');
  const tmp = arquivo + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(tmp, texto, { flag: 'wx', mode: 0o600 });
    fs.renameSync(tmp, arquivo);
  } finally {
    try { fs.unlinkSync(tmp); } catch (erro) { if (erro.code !== 'ENOENT') throw erro; }
  }
}

export function lerFontesInstalacao({ raizProjeto = PROJETO } = {}) {
  const c = caminhos(raizProjeto);
  if (!ambosOuNenhum(c)) {
    throw new Error('FONTES_AUSENTES: importe o JSON local com npm run respostas -- --importar-legado');
  }
  const textos = { respostas: lerArquivo(c.respostas), perfil: lerArquivo(c.perfil) };
  const fontes = lerFontes(textos);
  if (hash(JSON.stringify(fontes.banco)) === DADOS_NEUTROS.banco ||
      hash(JSON.stringify(fontes.perfil)) === DADOS_NEUTROS.perfil) {
    const dadosAntigos = legado(c);
    if ((hash(JSON.stringify(fontes.banco)) === DADOS_NEUTROS.banco && !isDeepStrictEqual(fontes.banco, dadosAntigos.banco)) ||
        (hash(JSON.stringify(fontes.perfil)) === DADOS_NEUTROS.perfil && !isDeepStrictEqual(fontes.perfil, dadosAntigos.perfil))) {
      throw new Error('MIGRACAO_PENDENTE: modelos Markdown vazios e JSON local diferente; rode npm run respostas -- --importar-legado');
    }
  }
  return { ...fontes, textos };
}

export function importarLegado({ raizProjeto = PROJETO } = {}) {
  const c = caminhos(raizProjeto);
  return comEscritaCentral(path.join(raizProjeto, 'vagas', 'data'), () => comTrava(c, () => {
    const anteriores = {
      respostas: existe(c.respostas) ? lerArquivo(c.respostas) : null,
      perfil: existe(c.perfil) ? lerArquivo(c.perfil) : null,
    };
    const dados = legado(c);
    const gerados = renderizarFontes(dados);
    lerFontes(gerados);
    for (const nome of ['respostas', 'perfil']) {
      if (anteriores[nome] !== null && hash(anteriores[nome]) !== MODELOS[nome] &&
          anteriores[nome] !== gerados[nome]) {
        throw new Error('FONTE_EDITADA: importação recusada; confira Markdown e JSON sem sobrescrever edição local');
      }
    }
    try {
      // Perfil primeiro mantém a autorização explícita se houver interrupção.
      // Nova chamada retoma um par parcialmente importado quando os bytes
      // já escritos ainda são exatamente os gerados a partir do mesmo JSON.
      for (const nome of ['perfil', 'respostas']) {
        if (anteriores[nome] !== gerados[nome]) gravarAtomico(c[nome], gerados[nome], anteriores[nome]);
      }
    } catch (erro) {
      try {
        for (const nome of ['respostas', 'perfil']) {
          const atual = existe(c[nome]) ? lerArquivo(c[nome]) : null;
          if (atual === anteriores[nome]) continue;
          if (atual !== gerados[nome]) throw new Error('CONFLITO_FONTES: arquivo mudou durante a recuperação');
          if (anteriores[nome] === null) fs.unlinkSync(c[nome]);
          else gravarAtomico(c[nome], anteriores[nome], gerados[nome]);
        }
      } catch (recuperacao) {
        throw new AggregateError([erro, recuperacao], 'MIGRACAO_INCOMPLETA: confira os Markdown e o JSON legado');
      }
      throw erro;
    }
    return { importadas: dados.banco.perguntas.length, autorizado: dados.perfil.autorizado === true };
  }));
}

export function atualizarPerfilInstalacao(alteracoes, { raizProjeto = PROJETO } = {}) {
  const c = caminhos(raizProjeto);
  if (!Array.isArray(alteracoes) || !alteracoes.length) throw new Error('ALTERACOES_AUSENTES');
  return comEscritaCentral(path.join(raizProjeto, 'vagas', 'data'), () => comTrava(c, () => {
    const atual = lerFontesInstalacao({ raizProjeto });
    let perfilMd = atual.textos.perfil;
    for (const { caminho, valor } of alteracoes) {
      perfilMd = atualizarPerfilCampo(perfilMd, caminho, valor);
    }
    const novo = lerFontes({ respostas: atual.textos.respostas, perfil: perfilMd });
    gravarAtomico(c.perfil, perfilMd, atual.textos.perfil);
    fs.writeFileSync(c.perfilJson, JSON.stringify(novo.perfil, null, 2) + '\n');
    return novo.perfil;
  }));
}
