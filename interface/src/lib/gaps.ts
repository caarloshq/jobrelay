export type GapLine = {
  text: string
  heading?: string
  marker?: "✅" | "🚫"
}

/** Presentation only: 🚫 marks an explicit pending item or blocker, never a rejection decision. */
export function gapLines(value: string): GapLine[] {
  return value
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      let text = line.trim().replace(/^[-*•]\s+/, "")
      let marker: GapLine["marker"]
      const explicit = text.match(/^(✅|🚫)\s*/)
      if (explicit) {
        marker = explicit[1] as GapLine["marker"]
        text = text.slice(explicit[0].length)
      }
      const markdownHeading = text.match(/^#{1,6}\s+(.+)$/)
      if (markdownHeading) text = markdownHeading[1]!
      const boldHeading = text.match(/^\*\*([^*]+)\*\*\s*:?(.*)$/)
      const isPathOrUrl =
        /^(?:[a-z][a-z0-9+.-]*:\/\/|[a-z]:[\\/]|[^\s:]*[\\/])/i.test(text)
      const colonHeading = isPathOrUrl
        ? null
        : text.match(/^([^:\n]{2,70}):(?:\s+|$)(.*)$/)
      const knownHeading =
        /^(?:Antes de enviar|Pontos de atenção|Conferência de \d{2}\/\d{2}\/\d{4}|Referências)$/i.test(
          text
        )
      const subtitle = boldHeading ?? colonHeading
      const heading =
        subtitle?.[1]?.replace(/:$/, "").trim() ??
        (markdownHeading || knownHeading ? text : undefined)
      const body = subtitle
        ? subtitle[2]!.trim()
        : markdownHeading || knownHeading
          ? ""
          : text
      const label = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
      if (!marker && body && !isPathOrUrl) {
        const evidenceText = label.replace(/https?:\/\/\S+|\S*[\\/]\S+/g, "")
        const pending =
          /\b(?:aguarda(?:ndo)?|falta conferir|a (?:confirmar|conferir)|pendente|em revisao|para revisao|ainda nao (?:foi )?enviad[oa]|nao (?:informa|divulgad[oa]|informad[oa]|comprovad[oa]|conferid[oa]|preparad[oa]))\b/.test(
            evidenceText
          )
        const blocker =
          /^(?:bloqueios?|impedimentos?|requisitos? nao atendidos?|nao atende(?: aos requisitos)?)(?:\s|$|:)/.test(
            evidenceText
          )
        const futureOrIntent =
          /\b(?:sera|serao|vai|vao|devera|deverao|podera|poderao|pretende|planeja|a ser|para (?:conferir|preparar|publicar)|deve ser|precisa ser|precisam ser)\b/.test(
            evidenceText
          )
        const confirmed =
          /^(?:requisitos? (?:atendidos?|confirmados?)|atendidos?|confirmados?|evidencias? confirmadas?)(?:\s|$|:)/.test(
            evidenceText
          ) ||
          /\b(?:conferid[oa]s?|publicad[oa]s?|preparad[oa]s?)\b/.test(
            evidenceText
          )
        if (pending || blocker) marker = "🚫"
        else if (
          confirmed &&
          !futureOrIntent &&
          !/\b(?:nao|sem)\b/.test(evidenceText)
        )
          marker = "✅"
      }
      return {
        text: body,
        ...(heading ? { heading } : {}),
        ...(marker ? { marker } : {}),
      }
    })
}
