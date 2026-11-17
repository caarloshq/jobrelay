// Plano neutro: somente títulos desta instalação. Não abre navegador nem usa Apify.
const limpar = valor => typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
const tituloValido = valor => valor.length > 1 && valor.length <= 160 && !/[\x00-\x1f]/.test(valor);
export function planejarConsultasLinkedin(perfil = {}, palavras = {}) {
  const feed = { url: 'https://www.linkedin.com/feed/', filtravelPorTermo: false };
  const titulos = [], vistos = new Set();
  const adicionar = (valor, origem) => {
    const titulo = limpar(valor), chave = titulo.toLocaleLowerCase('pt-BR');
    if (!tituloValido(titulo) || vistos.has(chave) || titulos.length >= 8) return;
    vistos.add(chave); titulos.push({ titulo, origem });
  };
  if (perfil?._configurado === true) {
    adicionar(perfil.cargo_alvo, 'perfil.cargo_alvo');
    adicionar(perfil.profissao, 'perfil.profissao');
  }
  if (!titulos.length) return { beta: true, estado: 'perfil_pendente', motivo: 'Conclua o onboarding e confirme seu cargo antes de preparar a busca.', consultas: [], feed };
  // Arquivos de exemplo não são preferência. O onboarding deve confirmar a profissão.
  if (perfil.profissao_confirmada === true) {
    if (Array.isArray(palavras.consultas_estreitas)) for (const titulo of palavras.consultas_estreitas) adicionar(titulo, 'palavras.consultas_estreitas');
    if (palavras.titulo_aceito && typeof palavras.titulo_aceito === 'object' && !Array.isArray(palavras.titulo_aceito)) for (const titulo of Object.keys(palavras.titulo_aceito)) adicionar(titulo, 'palavras.titulo_aceito');
  }
  const consultas = titulos.map(t => {
    const jobs = new URL('https://www.linkedin.com/jobs/search/');
    jobs.searchParams.set('keywords', t.titulo);
    const postagens = new URL('https://www.linkedin.com/search/results/content/');
    postagens.searchParams.set('keywords', `${t.titulo} vagas`);
    return { ...t, jobsUrl: jobs.href, postagensUrl: postagens.href };
  });
  return { beta: true, estado: 'pronto', consultas, feed };
}

// Confronta um atestado de observação da UI; não acessa o site nem prova cobertura.
export function conferirConsultaLinkedin(plano, { rota, titulo, urlObservada, termoObservado, bloqueada } = {}) {
  if (bloqueada === true) return { estado: 'bloqueada', fonteObservacao: 'interface' };
  if (rota === 'feed') return { estado: 'nao_filtravel', fonteObservacao: 'feed_sem_filtro_por_termo' };
  if (!['jobs', 'postagens'].includes(rota) || plano?.estado !== 'pronto' || bloqueada !== false) return { estado: 'incerta', fonteObservacao: 'interface' };
  const consulta = plano.consultas.find(c => c.titulo === titulo);
  if (!consulta) return { estado: 'incerta', fonteObservacao: 'interface' };
  let observada, esperada;
  try { observada = new URL(urlObservada); esperada = new URL(rota === 'jobs' ? consulta.jobsUrl : consulta.postagensUrl); }
  catch { return { estado: 'incerta', fonteObservacao: 'interface' }; }
  const termo = esperada.searchParams.get('keywords');
  if (observada.protocol !== 'https:' || observada.hostname !== esperada.hostname || observada.port || observada.username || observada.password || observada.pathname !== esperada.pathname || observada.searchParams.getAll('keywords').length !== 1 || observada.searchParams.get('keywords') !== termo || typeof termoObservado !== 'string' || termoObservado.trim() !== termo) return { estado: 'incerta', fonteObservacao: 'interface' };
  return { estado: 'confirmada', fonteObservacao: 'termo_conferido_na_interface', rota, titulo, termoObservado: termo };
}
