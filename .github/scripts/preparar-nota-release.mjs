import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function formatarDataPublicacao(instante = new Date()) {
  if (!(instante instanceof Date) || !Number.isFinite(instante.getTime())) throw new Error('DATA_INVALIDA');
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric',
  }).formatToParts(instante);
  const parte = tipo => partes.find(p => p.type === tipo).value;
  const mes = parte('month');
  return `${parte('day')} de ${mes[0].toLocaleUpperCase('pt-BR')}${mes.slice(1)} de ${parte('year')}`;
}

export function prepararNota(texto, instante = new Date()) {
  if (typeof texto !== 'string' || texto.split('DATA_PUBLICACAO').length !== 2 ||
      !/^DATA_PUBLICACAO[\t ]*$/m.test(texto)) throw new Error('MARCADOR_DATA_PUBLICACAO_INVALIDO');
  const pronto = texto.replace('DATA_PUBLICACAO', formatarDataPublicacao(instante));
  if (pronto.includes('DATA_PUBLICACAO')) throw new Error('MARCADOR_DATA_PUBLICACAO_RESTANTE');
  return pronto;
}

function main() {
  const [origem, destino, ...extras] = process.argv.slice(2);
  if (!origem || !destino || extras.length) throw new Error('USO: preparar-nota-release.mjs origem.md destino-temporario.md');
  if (path.resolve(origem) === path.resolve(destino)) throw new Error('DESTINO_PRECISA_SER_TEMPORARIO_DISTINTO');
  if (!fs.lstatSync(origem).isFile()) throw new Error('NOTA_FONTE_INVALIDA');
  // A data real so entra na copia temporaria, nunca no arquivo versionado.
  const pronto = prepararNota(fs.readFileSync(origem, 'utf8'));
  fs.writeFileSync(destino, pronto, { flag: 'wx', mode: 0o600 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (erro) { console.error(erro.message); process.exitCode = 1; }
}
