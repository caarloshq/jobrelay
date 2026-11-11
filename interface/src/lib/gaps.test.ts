import test from "node:test"
import assert from "node:assert/strict"
import { gapLines } from "./gaps.ts"

test("explicit labels and written emojis retain their meaning without modifying copy", () => {
  assert.deepEqual(
    gapLines(
      "Requisitos atendidos: Figma\nBloqueio: residência obrigatória\n✅ Inglês confirmado\n🚫 Não atende ao requisito"
    ),
    [
      { heading: "Requisitos atendidos", text: "Figma", marker: "✅" },
      { heading: "Bloqueio", text: "residência obrigatória", marker: "🚫" },
      { text: "Inglês confirmado", marker: "✅" },
      { text: "Não atende ao requisito", marker: "🚫" },
    ]
  )
})

test("missing evidence, negated blockers and next actions remain neutral", () => {
  for (const text of [
    "Não há bloqueios.",
    "Sem bloqueio confirmado.",

    "Próxima ação: revisar currículo",
    "Nenhum envio.",
  ]) {
    assert.equal(gapLines(text)[0]?.marker, undefined, text)
  }
})

test("markdown subtitles and list bullets become text structure, HTML stays inert text", () => {
  assert.deepEqual(
    gapLines(
      "## Pontos a conferir\n- **Mobilidade:** Sem evidência.\n<script>alert(1)</script>"
    ),
    [
      { heading: "Pontos a conferir", text: "" },
      { heading: "Mobilidade", text: "Sem evidência." },
      { text: "<script>alert(1)</script>" },
    ]
  )
})

test("explicit pending clauses take priority over prepared or confirmed clauses", () => {
  for (const text of [
    "Currículo preparado e aguarda revisão.",
    "Falta conferir o formulário.",
    "Anúncio não informa salário.",
    "Mobilidade ainda não comprovada.",
    "Candidatura ainda não foi enviada.",
    "Inglês a confirmar.",
  ]) {
    assert.equal(gapLines(text)[0]?.marker, "🚫", text)
  }
  for (const text of [
    "Anúncio conferido e publicado.",
    "Currículo preparado.",
  ]) {
    assert.equal(gapLines(text)[0]?.marker, "✅", text)
  }
})

test("known plain subtitles are emphasized and reference URLs stay unchanged", () => {
  const lines = gapLines(
    "Antes de enviar\nCurrículo preparado e aguarda revisão.\nPontos de atenção\nMobilidade ainda não comprovada.\nConferência de 11/11/2026\nAnúncio conferido e publicado.\nReferências\nhttps://example.com/job\nSkills/adapt-resume/builds/exemplo.pdf"
  )
  assert.deepEqual(
    lines.filter((line) => line.heading).map((line) => line.heading),
    [
      "Antes de enviar",
      "Pontos de atenção",
      "Conferência de 11/11/2026",
      "Referências",
    ]
  )
  assert.deepEqual(
    lines.filter((line) => line.marker).map((line) => line.marker),
    ["🚫", "🚫", "✅"]
  )
  assert.deepEqual(lines.slice(-2), [
    { text: "https://example.com/job" },
    { text: "Skills/adapt-resume/builds/exemplo.pdf" },
  ])
})

test("future intentions and URLs never become completed confirmations", () => {
  for (const text of [
    "O formulário será conferido no navegador.",
    "O currículo será preparado após a revisão.",
    "O currículo vai ser preparado.",
    "Anúncio a ser publicado.",
    "https://example.com/preparado.pdf",
    "Skills/adapt-resume/preparado.pdf",
    "Referência: https://example.com/preparado.pdf",
  ]) {
    assert.equal(gapLines(text)[0]?.marker, undefined, text)
  }
})

test("reference URLs and paths never become pending items", () => {
  for (const text of [
    "Referência: https://example.com/pendente.json",
    "Referência: Skills/aguardando/revisao.md",
  ]) {
    assert.equal(gapLines(text)[0]?.marker, undefined, text)
  }
})
