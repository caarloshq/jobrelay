// Relatório de títulos descartados: observação do filtro, sem alterar nota ou elegibilidade.
export function contarTitulosForaDaArea(descartadas = []) {
  if (!Array.isArray(descartadas)) throw new Error('DESCARTADAS_INVALIDAS');
  const contagens = new Map();
  for (const item of descartadas) {
    if (item?.motivo !== 'titulo fora da area' || typeof item.titulo !== 'string' || !item.titulo.trim()) continue;
    const titulo = item.titulo.trim();
    contagens.set(titulo, (contagens.get(titulo) || 0) + 1);
  }
  return Object.fromEntries(contagens);
}

export function resumirTitulosDescartados(rodadas = []) {
  if (!Array.isArray(rodadas)) throw new Error('RODADAS_INVALIDAS');
  const totais = new Map();
  let rodadasSemTitulos = 0;
  for (const rodada of rodadas) {
    if (!rodada || typeof rodada !== 'object' || Array.isArray(rodada)) throw new Error('RODADA_INVALIDA');
    if (!Object.hasOwn(rodada, 'titulosDescartadosForaDaArea')) { rodadasSemTitulos++; continue; }
    const titulos = rodada.titulosDescartadosForaDaArea;
    if (!titulos || typeof titulos !== 'object' || Array.isArray(titulos)) throw new Error('TITULOS_DESCARTADOS_INVALIDOS');
    for (const [titulo, quantidade] of Object.entries(titulos)) {
      if (!titulo.trim() || !Number.isSafeInteger(quantidade) || quantidade < 1) throw new Error('CONTAGEM_DESCARTE_INVALIDA');
      totais.set(titulo, (totais.get(titulo) || 0) + quantidade);
    }
  }
  return { rodadas: rodadas.length, rodadasSemTitulos,
    titulos: [...totais].map(([titulo, quantidade]) => ({ titulo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.titulo.localeCompare(b.titulo, 'pt-BR')) };
}
