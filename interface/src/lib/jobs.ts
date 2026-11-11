export type CompatibilityItem = {
  requisito: string
  estado: "atendido" | "lacuna" | "nao_comprovado"
  origem: { campo: "resumo" | "gaps"; trecho: string }
}

export type History = {
  em: string
  de: string | null
  para: string
  por: string
}

export type Job = {
  id: string
  titulo: string
  empresa: string
  link?: string
  logo?: string | null
  logoBackground?: string | null
  salario?: string | null
  localizacao?: string | null
  modelo?: string | null
  senioridade?: string | null
  compatibilidade: number | null
  lida?: boolean | null
  resumo?: string | null
  gaps?: string | null
  itensCompatibilidade?: CompatibilityItem[] | null
  fonte?: string | null
  pendencia?: string | null
  publicadaEm?: string | null
  prazo?: string | null
  aplicadaEm?: string | null
  resultado?: string | null
  curriculo?: string | null
  curriculoCaminho?: string | null
  status: string
  historico: History[]
}

export type BoardPayload = {
  vagas: Job[]
  status: string[]
  contagem: Record<string, number>
  demo: boolean
  cargoAlvo?: string
}

export type ScoreTone = "high" | "medium" | "low" | "partial" | "none"

export function scoreTone(job: Job): ScoreTone {
  if (job.compatibilidade == null || !Number.isFinite(job.compatibilidade))
    return "none"
  if (job.lida === false) return "partial"
  if (job.compatibilidade >= 75) return "high"
  if (job.compatibilidade >= 55) return "medium"
  return "low"
}

export function locationLabel(job: Job): string {
  return [workModel(job), ...(job.localizacao?.split(/\s+·\s+/) || [])]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .map((value) => value.trim())
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" · ")
}

/** Explicit wording only; never infers a hiring country from remote work. */
export function workModel(job: Job): string | null {
  if (job.modelo?.trim()) return job.modelo.trim()
  return /\b(?:remote|remoto|remota|work\s+from\s+home)\b/i.test(job.titulo)
    ? "Remoto"
    : null
}
