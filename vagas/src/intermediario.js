// Classificação conhecida; o nome de uma consultoria não prova intermediação.
export function viaIntermediario(empresa) {
  return /jobgether|n[aã]o revelada/i.test(String(empresa || ''));
}
