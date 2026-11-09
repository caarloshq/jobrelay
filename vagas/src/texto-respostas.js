const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const METATEXTO = /(?:traducao para (?:o )?ingles|resposta enviada em|texto sobre|\[todo\]|\btodo\s*:|ver data\/|depende da vaga|nao declarar fluencia|\b(?:tbd|lorem ipsum)\b|\[(?:preencher|inserir)[^\]]*\])/;

export function contemMetatexto(valor) {
  return typeof valor === 'string' && METATEXTO.test(normalizar(valor));
}
