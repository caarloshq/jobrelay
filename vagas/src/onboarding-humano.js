// Registro de passagem pelo HTML local. Não é prova de identidade humana:
// quem controla esta máquina pode alterar o código. Agentes não podem forjá-lo.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const MENSAGEM = 'ONBOARDING_HUMANO_OBRIGATORIO: abra o HTML com npm start, preencha pessoalmente os sete passos e confirme o resumo. A IA deve aguardar.';
export function concluido(dirDados) {
  try {
    const r = JSON.parse(readFileSync(join(dirDados, 'onboarding-humano.json'), 'utf8'));
    return r.versao === 1 && r.origem === 'html-local' && r.confirmadoPelaPessoa === true &&
      Number.isFinite(Date.parse(r.concluidoEm)) && Array.isArray(r.passos) &&
      r.passos.length === 7 && r.passos.every((n, i) => n === i + 1);
  } catch { return false; }
}
export function exigirOnboardingHumano(dirDados) {
  if (!concluido(dirDados)) throw new Error(MENSAGEM);
}
export function criarSessaoFormulario(dirDados) {
  const passos = new Set();
  return {
    validarPasso(passo) {
      if (!Number.isInteger(passo) || passo < 1 || passo > 7 ||
          Array.from({ length: passo - 1 }, (_, i) => i + 1).some(n => !passos.has(n))) {
        throw new Error('ONBOARDING_FORA_DE_ORDEM: percorra os passos anteriores no HTML.');
      }
    },
    registrarPasso(passo) { this.validarPasso(passo); passos.add(passo); },
    confirmar(confirmado) {
      if (confirmado !== true || passos.size !== 7) throw new Error(MENSAGEM);
      mkdirSync(dirDados, { recursive: true });
      writeFileSync(join(dirDados, 'onboarding-humano.json'), JSON.stringify({
        versao: 1, origem: 'html-local', confirmadoPelaPessoa: true,
        passos: [1, 2, 3, 4, 5, 6, 7], concluidoEm: new Date().toISOString(),
      }, null, 2) + '\n');
    },
  };
}
