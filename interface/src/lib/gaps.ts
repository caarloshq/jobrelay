import type { CompatibilityItem, Job } from "./jobs.ts"

const states = new Set(["atendido", "lacuna", "nao_comprovado"])

/** Only authored comparisons with a literal source are shown as compatibility. */
export function compatibilityItems(job: Job): CompatibilityItem[] {
  if (!Array.isArray(job.itensCompatibilidade)) return []
  return job.itensCompatibilidade.filter((item) => {
    if (
      !item ||
      typeof item.requisito !== "string" ||
      !item.requisito.trim() ||
      !states.has(item.estado)
    )
      return false
    const origin = item.origem
    if (
      !origin ||
      !["resumo", "gaps"].includes(origin.campo) ||
      typeof origin.trecho !== "string" ||
      !origin.trecho.trim()
    )
      return false
    const source = job[origin.campo]
    return typeof source === "string" && source.includes(origin.trecho)
  })
}
