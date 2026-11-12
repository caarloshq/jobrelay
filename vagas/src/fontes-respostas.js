// Formato portátil das fontes de candidatura. Somente os blocos jobrelay são dados;
// texto editorial fora deles pode explicar decisões e pendências sem virar resposta.
import { createHash } from 'node:crypto';
const VERSAO = 'jobrelay-fontes-v1';
const TIPOS = new Set(['object', 'array', 'string', 'number', 'boolean', 'null']);

const ARSENAL = Object.freeze([
  '# Arsenal de entrevista',
  '',
  'Base de respostas de entrevista e de perguntas abertas de candidatura: trajetória, projetos, forma de trabalhar e motivação. Junto com o currículo, é daqui que saem as respostas abertas das candidaturas. Pergunta aberta sem resposta é registrada no banco e aparece em Respostas pendentes, no topo deste arquivo. Quando você responde, a resposta é gravada nesse registro pelo fluxo normal, e a versão em fala entra no fim desta seção, depois da última pergunta numerada (a primeira vai logo após Regras de uso). Dados objetivos, como pretensão, data de início e respostas de sim ou não, ficam no Perfil.',
  '',
  'Formato de cada pergunta:',
  '',
  '- Título `## N. <pergunta>`, com a pergunta como um entrevistador faria.',
  '- Resposta em fala, em primeira pessoa, num bloco de citação (`> `). Parágrafos curtos.',
  '- Escrita a partir das suas palavras e passada pela revisão de escrita (Skills/review-escrita) antes de ser usada.',
  '- Se já existe uma pergunta equivalente, completar a resposta dela em vez de criar outra.',
  '- Não use blocos de código com etiqueta `jobrelay` nesta seção: eles são reservados aos dados do arquivo.',
  '',
  '## Regras de uso',
  '',
  'Restrições factuais que valem para todas as respostas, como números que podem ou não ser citados.',
]);

function objeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(`Fontes de respostas inválidas: ${mensagem}`);
}

function cerca(conteudo, etiqueta, cabecalho = '') {
  const maximo = Math.max(2, ...[...conteudo.matchAll(/`+/g)].map(m => m[0].length));
  const marcador = '`'.repeat(maximo + 1);
  return `${marcador}${etiqueta}${cabecalho ? ` ${JSON.stringify(cabecalho)}` : ''}\n${conteudo}\n${marcador}`;
}

function blocos(texto, nome) {
  exigir(typeof texto === 'string' && texto.startsWith(`<!-- ${VERSAO}:${nome} -->\n`), `marcador de ${nome} ausente`);
  const linhas = texto.split('\n');
  const encontrados = [];
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const abertura = /^(`{3,})(jobrelay-[\w-]+)(?: (.+))?$/.exec(linha);
    if (!abertura) {
      exigir(!/^`{3,}jobrelay-/.test(linha), `abertura malformada na linha ${i + 1}`);
      continue;
    }
    const [ , delimitador, etiqueta, argumento ] = abertura;
    let fim = i + 1;
    while (fim < linhas.length && linhas[fim] !== delimitador) fim++;
    exigir(fim < linhas.length, `bloco ${etiqueta} sem fechamento na linha ${i + 1}`);
    encontrados.push({ etiqueta, argumento, conteudo: linhas.slice(i + 1, fim).join('\n') });
    i = fim;
  }
  return encontrados;
}

function json(texto, contexto) {
  try {
    const valor = JSON.parse(texto);
    // JSON.parse sozinho aceita chaves repetidas e preserva apenas a última.
    // Varremos os objetos recursivamente antes de aceitar fonte, aprovação ou escopo.
    let posicao = 0;
    const espacos = () => { while (/\s/.test(texto[posicao] || '')) posicao++; };
    const cadeia = () => {
      const inicio = posicao++;
      while (posicao < texto.length) {
        if (texto[posicao] === '\\') { posicao += 2; continue; }
        if (texto[posicao++] === '"') return JSON.parse(texto.slice(inicio, posicao));
      }
      throw new Error('cadeia sem fechamento');
    };
    const valorLexico = () => {
      espacos();
      if (texto[posicao] === '{') {
        posicao++; espacos();
        const chaves = new Set();
        while (texto[posicao] !== '}') {
          const chave = cadeia();
          if (chaves.has(chave)) throw new Error(`chave duplicada em ${contexto}: ${chave}`);
          chaves.add(chave); espacos(); posicao++; // dois pontos, já validado por JSON.parse
          valorLexico(); espacos();
          if (texto[posicao] === ',') { posicao++; espacos(); } else break;
        }
        posicao++; return;
      }
      if (texto[posicao] === '[') {
        posicao++; espacos();
        while (texto[posicao] !== ']') {
          valorLexico(); espacos();
          if (texto[posicao] === ',') { posicao++; espacos(); } else break;
        }
        posicao++; return;
      }
      if (texto[posicao] === '"') { cadeia(); return; }
      while (posicao < texto.length && !/[\s,\]}]/.test(texto[posicao])) posicao++;
    };
    valorLexico();
    return valor;
  }
  catch (erro) {
    if (erro.message.startsWith('chave duplicada')) throw new Error(`Fontes de respostas inválidas: ${erro.message}`);
    throw new Error(`Fontes de respostas inválidas: JSON de ${contexto} malformado`);
  }
}

function resumoCaminhos(campos) {
  return createHash('sha256').update(JSON.stringify(campos.map(campo => campo.caminho))).digest('hex');
}

function destino(pergunta) {
  const base = String(pergunta.normalizada || pergunta.pergunta || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // Lista positiva: Sim/Não sobre experiência, habilidade ou trajetória continua profissional.
  const padroes = [
    /^(?:qual|informe|insira|digite|what is|enter|provide|please provide) (?:o |a |your |seu |sua )?(?:nome(?: completo)?|full name|email|e mail|telefone|phone(?: number)?|cidade|city|estado|state|pais|country|endereco|address|linkedin|portfolio|portifolio)(?:\b|$)/,
    /^(?:qual|informe|insira|digite|what is|enter|provide) (?:a |o |your |sua |seu )?(?:pretensao salarial|expectativa salarial|salary expectation|expected salary|current salary|ultimo salario|last salary|disponibilidade|availability)(?:\b|$)/,
    /^(?:voce foi indicado|foi indicado|were you referred|have you been referred|do you need visa sponsorship|will you require sponsorship|precisa de patrocinio de visto|possui autorizacao para trabalhar|are you authorized to work)(?:\b|$)/,
    /^(?:qual|what is|select|selecione) (?:o |a |your |seu |sua )?(?:nivel de ingles|english level|nivel de escolaridade|education level|tipo de contrato|contract type|modelo de trabalho|work model)(?:\b|$)/,
    /^(?:salary as (?:employee|contractor)|type of contract|data de nascimento|date of birth|twitter url|linkedin url|portfolio url)(?:\b|$)/,
    /^(?:qual|informe|insira|digite|what is|enter|provide) (?:o |a |your |seu |sua )?(?:cpf|rg|rne|data de nascimento|date of birth|remuneracao atual|pretensao(?: salarial)?(?: por hora)?|salario|compensacao|cep|postal code|codigo postal)(?:\b|$)/,
    /^(?:voce (?:possui|tem) parentesco|voce (?:e|ja foi) colaborador|voce ja trabalhou (?:na|em alguma empresa do grupo)|voce tem participacao societaria|how (?:did you|have you) (?:hear|heard)|como voce (?:ficou sabendo|soube)|em quantos dias corridos voce conseguiria iniciar)(?:\b|$)/,
    /^(?:are you (?:willing|available|legally authorized)|voce (?:esta disponivel|pode trabalhar|aceita trabalhar|tem disponibilidade)|qual (?:e )?o seu nivel atual de escolaridade|voce possui formacao de nivel superior)(?:\b|$)/,
    /^(?:full name|name|email|e mail|phone|phone number|current location|location|city|state|country|address|postal code|zip code|cpf|rg|rne|date of birth|expected salary|salary expectation|current salary|last salary|compensation expectation|availability|start date|notice period|gender|pronouns|disability status|work authorization|visa sponsorship|contract type|employment type|education level|english level)(?:\b|$)/,
    /^(?:salary|compensation|remuneration|remuneracao|pretensao salarial|pretensao por hora|expectativa salarial|disponibilidade|data de inicio|localizacao atual|cidade atual|estado atual|pais atual|nome completo|telefone|endereco completo)(?:\b|$)/,
  ];
  return padroes.some(padrao => padrao.test(base)) ? 'perfil' : 'respostas';
}

export function classificarPergunta(pergunta) {
  exigir(objeto(pergunta), 'pergunta deve ser objeto');
  return destino(pergunta);
}

function verificarBanco(banco) {
  exigir(objeto(banco) && Array.isArray(banco.perguntas), 'banco precisa de perguntas em lista');
  const ids = new Set();
  for (const [indice, registro] of banco.perguntas.entries()) {
    exigir(objeto(registro), `registro ${indice} inválido`);
    exigir(typeof registro.pergunta === 'string' && registro.pergunta.length > 0, `pergunta ausente no registro ${indice}`);
    exigir(registro.resposta === null || typeof registro.resposta === 'string', `resposta inválida no registro ${indice}`);
    if (registro.id !== undefined) {
      exigir(typeof registro.id === 'string' && registro.id.length > 0, `ID inválido no registro ${indice}`);
      exigir(!ids.has(registro.id), `ID duplicado: ${registro.id}`);
      ids.add(registro.id);
    }
  }
}

function nos(valor, caminho = []) {
  const tipo = valor === null ? 'null' : Array.isArray(valor) ? 'array' : typeof valor;
  exigir(TIPOS.has(tipo), `tipo de perfil não suportado em ${JSON.stringify(caminho)}`);
  const atual = [{ caminho, tipo, conteudo: ['string', 'number', 'boolean'].includes(tipo) ? String(valor) : '' }];
  if (tipo === 'object' || tipo === 'array') {
    for (const [chave, filho] of Object.entries(valor)) atual.push(...nos(filho, [...caminho, tipo === 'array' ? Number(chave) : chave]));
  }
  return atual;
}

export function renderizarFontes({ banco, perfil }, { arsenal = true } = {}) {
  verificarBanco(banco);
  exigir(objeto(perfil), 'perfil precisa ser objeto');
  const metadados = { ...banco }; delete metadados.perguntas;
  const respostas = [`<!-- ${VERSAO}:respostas -->`, '# Respostas profissionais', '',
    cerca(JSON.stringify({ total: banco.perguntas.length, metadados }, null, 2), 'jobrelay-banco')];
  const campos = nos(perfil);
  const perfilMd = [`<!-- ${VERSAO}:perfil -->`, '# Perfil e escolhas objetivas', '',
    cerca(JSON.stringify({ total: campos.length, caminhosSha256: resumoCaminhos(campos) }, null, 2), 'jobrelay-perfil-manifesto')];
  const grupos = {
    respostas: { pendentes: [], disponiveis: [] },
    perfil: { pendentes: [], disponiveis: [] },
  };
  for (const [ordem, registro] of banco.perguntas.entries()) {
    const destinoArquivo = destino(registro);
    const pendente = registro.resposta === null || registro.aprovada !== true;
    const saida = grupos[destinoArquivo][pendente ? 'pendentes' : 'disponiveis'];
    const dados = { ...registro }; delete dados.pergunta; delete dados.resposta;
    const estado = registro.resposta === null ? 'sem resposta' : 'aguarda aprovação';
    saida.push('', `### Pergunta ${ordem + 1}${pendente ? ` · ${estado}` : ''}: ${registro.pergunta.replace(/\r?\n/g, ' ')}`, '',
      cerca(JSON.stringify({ ordem, respostaNula: registro.resposta === null, dados }, null, 2), 'jobrelay-registro'), '',
      cerca(registro.pergunta, 'jobrelay-enunciado'), '',
      cerca(registro.resposta ?? '', 'jobrelay-resposta'));
  }
  const camposPendentes = campos.filter(no => no.tipo === 'null' && no.caminho.length > 0);
  for (const [nome, saida] of [['respostas', respostas], ['perfil', perfilMd]]) {
    saida.push('', '## Respostas pendentes', '');
    if (nome === 'perfil' && camposPendentes.length) {
      saida.push('### Campos do perfil sem resposta', '',
        ...camposPendentes.map(no => `- ${no.caminho.join(' / ')}`), '');
    }
    saida.push(...grupos[nome].pendentes,
      '', '## Respostas disponíveis', '', ...grupos[nome].disponiveis);
  }
  // Texto livre, fora dos blocos cercados: o leitor ignora prosa e o
  // importador não sobrescreve um arquivo já editado.
  if (arsenal) respostas.push('', ...ARSENAL);
  perfilMd.push('', '## Campos do perfil');
  for (const no of campos) {
    perfilMd.push('', `### ${no.caminho.length ? no.caminho.join(' / ') : 'Estrutura do perfil'}`, '',
      cerca(no.conteudo, 'jobrelay-campo', { caminho: no.caminho, tipo: no.tipo }));
  }
  return { respostas: respostas.join('\n').trimEnd() + '\n', perfil: perfilMd.join('\n').trimEnd() + '\n' };
}

function reconstruirPerfil(lista) {
  exigir(lista.length > 0, 'perfil sem campos');
  let raiz;
  const vistos = new Set();
  for (const bloco of lista) {
    exigir(bloco.etiqueta === 'jobrelay-campo' && bloco.argumento, 'bloco inesperado no perfil');
    const meta = json(bloco.argumento, 'campo do perfil');
    exigir(objeto(meta) && Array.isArray(meta.caminho) && TIPOS.has(meta.tipo), 'metadado de campo inválido');
    const { caminho, tipo } = meta;
    exigir(caminho.every(parte => typeof parte === 'string' || Number.isSafeInteger(parte)), 'caminho de campo inválido');
    exigir(caminho.every(parte => parte !== '__proto__' && parte !== 'prototype' && parte !== 'constructor'), 'chave de perfil insegura');
    const chave = JSON.stringify(caminho);
    exigir(!vistos.has(chave), `campo duplicado ${chave}`); vistos.add(chave);
    let valor;
    if (tipo === 'object') { exigir(bloco.conteudo === '', `objeto ${chave} com valor`); valor = {}; }
    else if (tipo === 'array') { exigir(bloco.conteudo === '', `lista ${chave} com valor`); valor = []; }
    else if (tipo === 'null') { exigir(bloco.conteudo === '', `null ${chave} com valor`); valor = null; }
    else if (tipo === 'string') valor = bloco.conteudo;
    else if (tipo === 'boolean') { exigir(/^(true|false)$/.test(bloco.conteudo), `booleano inválido ${chave}`); valor = bloco.conteudo === 'true'; }
    else { valor = Number(bloco.conteudo); exigir(Number.isFinite(valor) && String(valor) === bloco.conteudo, `número inválido ${chave}`); }
    if (caminho.length === 0) { exigir(raiz === undefined && tipo === 'object', 'raiz inválida'); raiz = valor; continue; }
    exigir(raiz !== undefined, 'raiz deve ser o primeiro campo');
    let pai = raiz;
    for (const segmento of caminho.slice(0, -1)) {
      exigir(pai !== null && typeof pai === 'object' && Object.hasOwn(pai, segmento), `pai ausente de ${chave}`);
      pai = pai[segmento];
    }
    const ultimo = caminho.at(-1);
    exigir(pai !== null && typeof pai === 'object', `pai inválido de ${chave}`);
    exigir(Array.isArray(pai) ? Number.isInteger(ultimo) && ultimo === pai.length : typeof ultimo === 'string' && !Object.hasOwn(pai, ultimo), `ordem ou chave inválida de ${chave}`);
    pai[ultimo] = valor;
  }
  return raiz;
}

export function lerFontes({ respostas, perfil }) {
  const partesRespostas = blocos(respostas, 'respostas');
  const partesPerfil = blocos(perfil, 'perfil');
  exigir(partesRespostas[0]?.etiqueta === 'jobrelay-banco' && !partesRespostas[0].argumento, 'metadados do banco ausentes');
  const manifestoBanco = json(partesRespostas[0].conteudo, 'banco');
  exigir(objeto(manifestoBanco) && Number.isSafeInteger(manifestoBanco.total) && manifestoBanco.total >= 0 && objeto(manifestoBanco.metadados), 'metadados do banco inválidos');
  const banco = manifestoBanco.metadados;
  exigir(!Object.hasOwn(banco, 'perguntas'), 'metadados do banco inválidos');
  const porOrdem = new Map();
  const ids = new Set();
  function lerRegistros(partes, inicio) {
    let indice = inicio;
    while (indice < partes.length && partes[indice].etiqueta === 'jobrelay-registro') {
      const meta = json(partes[indice].conteudo, 'registro');
      exigir(objeto(meta) && Number.isSafeInteger(meta.ordem) && meta.ordem >= 0 && typeof meta.respostaNula === 'boolean' && objeto(meta.dados), 'metadados de registro inválidos');
      exigir(!Object.hasOwn(meta.dados, 'pergunta') && !Object.hasOwn(meta.dados, 'resposta'), 'pergunta/resposta duplicada nos metadados');
      exigir(partes[indice + 1]?.etiqueta === 'jobrelay-enunciado' && partes[indice + 2]?.etiqueta === 'jobrelay-resposta', `pergunta ${meta.ordem} incompleta`);
      const pergunta = partes[indice + 1].conteudo;
      const resposta = partes[indice + 2].conteudo;
      exigir(pergunta.length > 0, `enunciado ${meta.ordem} vazio`);
      exigir(!meta.respostaNula || resposta === '', `resposta null ${meta.ordem} contém texto`);
      exigir(!porOrdem.has(meta.ordem), `ordem duplicada ${meta.ordem}`);
      const registro = { pergunta, ...meta.dados, resposta: meta.respostaNula ? null : resposta };
      if (registro.id !== undefined) {
        exigir(typeof registro.id === 'string' && registro.id.length > 0 && !ids.has(registro.id), `ID inválido ou duplicado ${registro.id}`);
        ids.add(registro.id);
      }
      exigir(destino(registro) === (partes === partesPerfil ? 'perfil' : 'respostas'), `pergunta ${meta.ordem} está no arquivo errado`);
      porOrdem.set(meta.ordem, registro);
      indice += 3;
    }
    return indice;
  }
  exigir(lerRegistros(partesRespostas, 1) === partesRespostas.length, 'bloco inesperado em RESPOSTAS.md');
  // Lê também o arranjo anterior, com manifesto após as perguntas, para poder
  // reorganizar fontes já editadas sem voltar à projeção JSON.
  const manifestoPrimeiro = partesPerfil[0]?.etiqueta === 'jobrelay-perfil-manifesto';
  const aposRegistros = lerRegistros(partesPerfil, manifestoPrimeiro ? 1 : 0);
  const indiceManifesto = manifestoPrimeiro ? 0 : aposRegistros;
  exigir(partesPerfil[indiceManifesto]?.etiqueta === 'jobrelay-perfil-manifesto', 'manifesto de perfil ausente');
  const manifestoPerfil = json(partesPerfil[indiceManifesto].conteudo, 'manifesto de perfil');
  const inicioCampos = manifestoPrimeiro ? aposRegistros : aposRegistros + 1;
  const blocosCampos = partesPerfil.slice(inicioCampos);
  exigir(objeto(manifestoPerfil) && Number.isSafeInteger(manifestoPerfil.total) && manifestoPerfil.total === blocosCampos.length, 'quantidade de campos do perfil divergente');
  const campos = blocosCampos.map(bloco => {
    exigir(bloco.etiqueta === 'jobrelay-campo', 'bloco inesperado no perfil');
    return json(bloco.argumento, 'campo do perfil');
  });
  exigir(manifestoPerfil.caminhosSha256 === resumoCaminhos(campos), 'caminhos do perfil divergentes');
  const perfilObjeto = reconstruirPerfil(blocosCampos);
  const perguntas = [];
  for (let ordem = 0; ordem < porOrdem.size; ordem++) {
    exigir(porOrdem.has(ordem), `sequência incompleta: falta pergunta ${ordem}`);
    perguntas.push(porOrdem.get(ordem));
  }
  exigir(perguntas.length === manifestoBanco.total, 'quantidade de perguntas divergente');
  banco.perguntas = perguntas;
  verificarBanco(banco);
  return { banco, perfil: perfilObjeto };
}

export function atualizarPerfilCampo(perfilMd, caminho, valor) {
  exigir(Array.isArray(caminho) && caminho.length > 0, 'caminho de perfil inválido');
  const tipo = valor === null ? 'null' : typeof valor;
  exigir(['string', 'number', 'boolean', 'null'].includes(tipo), 'atualização aceita somente valor simples');
  if (tipo === 'number') exigir(Number.isFinite(valor), 'número de perfil inválido');
  // Encontra o bloco exato; preserva cabeçalhos, notas e outros campos byte a byte.
  const linhas = perfilMd.split('\n');
  let encontrado = false;
  for (let i = 0; i < linhas.length; i++) {
    const abertura = /^(`{3,})jobrelay-campo (.+)$/.exec(linhas[i]);
    if (!abertura) continue;
    const meta = json(abertura[2], 'campo do perfil');
    if (JSON.stringify(meta.caminho) !== JSON.stringify(caminho)) continue;
    exigir(!encontrado, `campo duplicado ${JSON.stringify(caminho)}`);
    exigir(['string', 'number', 'boolean', 'null'].includes(meta.tipo), 'campo é uma estrutura, não um valor simples');
    let fim = i + 1;
    while (fim < linhas.length && linhas[fim] !== abertura[1]) fim++;
    exigir(fim < linhas.length, 'campo sem fechamento');
    const novoConteudo = tipo === 'null' ? '' : String(valor);
    const novoBloco = cerca(novoConteudo, 'jobrelay-campo', { caminho, tipo }).split('\n');
    linhas.splice(i, fim - i + 1, ...novoBloco);
    encontrado = true;
    i += novoBloco.length - 1;
  }
  exigir(encontrado, `campo ausente ${JSON.stringify(caminho)}`);
  const resultado = linhas.join('\n');
  const campos = blocos(resultado, 'perfil').filter(bloco => bloco.etiqueta === 'jobrelay-campo');
  reconstruirPerfil(campos);
  return resultado;
}
