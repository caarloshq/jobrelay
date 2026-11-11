import test from "node:test"
import assert from "node:assert/strict"
import { compatibilityItems } from "./gaps.ts"
import type { Job } from "./jobs.ts"

const job: Job = {
  id: "ficticio:1",
  titulo: "Exemplo",
  empresa: "Empresa fictícia",
  compatibilidade: 90,
  status: "Avaliar",
  historico: [],
  resumo: "A vaga pede Figma. A pessoa comprova protótipos em Figma.",
  gaps: "A vaga pede cinco anos; a pessoa registra três. GraphQL não comprovado.",
}

test("only authored comparisons with exact source quotes are displayed", () => {
  const items = [
    {
      requisito: "Figma",
      estado: "atendido" as const,
      origem: {
        campo: "resumo" as const,
        trecho: "A pessoa comprova protótipos em Figma.",
      },
    },
    {
      requisito: "5+ anos (base registra 3)",
      estado: "lacuna" as const,
      origem: {
        campo: "gaps" as const,
        trecho: "A vaga pede cinco anos; a pessoa registra três.",
      },
    },
    {
      requisito: "GraphQL",
      estado: "nao_comprovado" as const,
      origem: { campo: "gaps" as const, trecho: "GraphQL não comprovado." },
    },
  ]
  assert.deepEqual(
    compatibilityItems({ ...job, itensCompatibilidade: items }),
    items
  )
})

test("legacy operational text and score never become qualification claims", () => {
  for (const gaps of [
    "Currículo preparado e anúncio publicado.",
    "Candidatura enviada.",
    "Salário não divulgado.",
    "https://example.com/preparado.pdf",
    "Falta conferir o formulário.",
  ]) {
    assert.deepEqual(
      compatibilityItems({ ...job, gaps, compatibilidade: 100 }),
      []
    )
  }
})

test("missing, invalid or untraceable structured evidence is omitted without altering raw data", () => {
  const input = {
    ...job,
    itensCompatibilidade: [
      {
        requisito: "Figma",
        estado: "atendido",
        origem: {
          campo: "resumo",
          trecho: "Experiência que não consta na fonte",
        },
      },
      {
        requisito: "GraphQL",
        estado: "incapaz",
        origem: { campo: "gaps", trecho: "GraphQL não comprovado." },
      },
      {
        requisito: "Figma",
        estado: "atendido",
        origem: { campo: "resumo", trecho: "" },
      },
      {
        requisito: "",
        estado: "atendido",
        origem: { campo: "resumo", trecho: "A vaga pede Figma." },
      },
    ],
  } as Job
  const before = structuredClone(input)
  assert.deepEqual(compatibilityItems(input), [])
  assert.deepEqual(input, before)
  assert.deepEqual(
    compatibilityItems({ ...job, itensCompatibilidade: null }),
    []
  )
})
