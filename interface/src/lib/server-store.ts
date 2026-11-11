import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import type { BoardPayload, Job } from "./jobs.ts"

export const STATUSES = [
  "Avaliar",
  "Aplicar",
  "Já apliquei",
  "Entrevista",
  "Cancelada",
]
const allowedStatuses = new Set([...STATUSES, "Aplicado por IA", "Revisar"])

export class BoardError extends Error {
  status: number
  constructor(message: string, status = 422) {
    super(message)
    this.status = status
  }
}

export function validateBackendUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new BoardError("Endereço do servidor local inválido.", 503)
  }
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    throw new BoardError("Use um endereço HTTP de localhost ou 127.0.0.1.", 503)
  return url
}

export function validateTransition(value: unknown): {
  id: string
  status: string
} {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BoardError("Informe a vaga e a fase.")
  const { id, status } = value as Record<string, unknown>
  if (
    typeof id !== "string" ||
    !id.trim() ||
    id.length > 256 ||
    [...id].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
    )
  ) {
    throw new BoardError("Vaga inválida.")
  }
  if (typeof status !== "string" || !allowedStatuses.has(status))
    throw new BoardError("Fase inválida.")
  return { id, status }
}

function logo(color: string, shape: string): string {
  return (
    "data:image/svg+xml;base64," +
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="${color}"/>${shape}</svg>`
    ).toString("base64")
  )
}

function fixtures(): Job[] {
  const values = [
    [
      "aurora",
      "Product Designer Sênior",
      "Aurora",
      "R$ 12.000 a 15.000/mês",
      "Sênior",
      92,
      "Avaliar",
      "#176b72",
      '<path d="M12 34 24 10 36 34Z" fill="white"/>',
    ],
    [
      "orbita",
      "Brand Designer",
      "Órbita",
      "R$ 9.000 a 12.000/mês",
      "Sênior",
      85,
      "Aplicar",
      "#6f4e9c",
      '<ellipse cx="24" cy="24" rx="16" ry="7" fill="none" stroke="white" stroke-width="3" transform="rotate(-35 24 24)"/>',
    ],
    [
      "ponte",
      "UX/UI Designer",
      "Ponte",
      "R$ 8.000 a 10.000/mês",
      "Pleno",
      78,
      "Já apliquei",
      "#245d9c",
      '<path d="M10 32V22q14-22 28 0v10" stroke="white" stroke-width="4" fill="none"/>',
    ],
    [
      "nuvem",
      "Product Designer · Design System",
      "Nuvem",
      "R$ 14.000 a 17.000/mês",
      "Sênior",
      95,
      "Entrevista",
      "#377b60",
      '<path d="M13 32v-16l22 16v-16" stroke="white" stroke-width="4" fill="none"/>',
    ],
    [
      "farol",
      "Visual Designer",
      "Farol",
      "R$ 7.000 a 9.000/mês",
      "Pleno",
      67,
      "Cancelada",
      "#97602c",
      '<path d="M18 35V12h16M18 23h12" stroke="white" stroke-width="4" fill="none"/>',
    ],
  ] as const
  return values.map(
    ([
      id,
      titulo,
      empresa,
      salario,
      senioridade,
      compatibilidade,
      status,
      color,
      shape,
    ]) => ({
      id: `demo:${id}`,
      titulo,
      empresa,
      salario,
      senioridade,
      compatibilidade,
      status,
      link: `https://example.com/jobrelay-demo/${id}`,
      logo: logo(color, shape),
      modelo: "Remoto",
      localizacao: "Brasil",
      lida: true,
      fonte: "Exemplo fictício",
      resumo:
        "Oportunidade fictícia de design, criada para visualizar os detalhes da vaga.",
      gaps: "Inglês e disponibilidade para início a confirmar.",
      historico: [
        {
          em: "2026-11-11T12:00:00.000Z",
          de: null,
          para: status,
          por: "demonstração",
        },
      ],
    })
  )
}

export function createDemoStore(initialJobs: Job[] = fixtures()) {
  const jobs = structuredClone(initialJobs)
  const read = (): BoardPayload => ({
    vagas: structuredClone(jobs),
    status: [...STATUSES],
    demo: true,
    contagem: jobs.reduce<Record<string, number>>(
      (counts, job) => {
        counts[job.status] = (counts[job.status] || 0) + 1
        return counts
      },
      Object.fromEntries(STATUSES.map((status) => [status, 0]))
    ),
    cargoAlvo: "Demonstração",
  })
  return {
    read,
    move(value: unknown): BoardPayload {
      const { id, status } = validateTransition(value)
      if (!STATUSES.includes(status)) throw new BoardError("Fase inválida.")
      const job = jobs.find((job) => job.id === id)
      if (!job) throw new BoardError("Vaga não encontrada.")
      if (job.status !== status) {
        job.historico.push({
          em: new Date().toISOString(),
          de: job.status,
          para: status,
          por: "pessoa",
        })
        job.status = status
      }
      return read()
    },
  }
}

/** Isolated visual prototype. Never writes the operational board or Notion. */
export function createFileStore(filename: string) {
  if (!path.isAbsolute(filename))
    throw new BoardError(
      "Configure um caminho absoluto para o quadro de teste.",
      503
    )
  // Backup snapshots may share the inode. Reading is safe; writes always publish
  // a new inode with rename, so linked backups are never edited in place.
  function safeFile(file: string) {
    const stat = fs.lstatSync(file)
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      fs.realpathSync(file) !== file
    )
      throw new BoardError("Arquivo do quadro de teste inválido.", 503)
    return stat
  }
  function read(): BoardPayload {
    const before = safeFile(filename)
    const fd = fs.openSync(
      filename,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW
    )
    let data: BoardPayload
    try {
      const opened = fs.fstatSync(fd)
      if (opened.ino !== before.ino || opened.dev !== before.dev)
        throw new BoardError("O arquivo do quadro mudou. Tente novamente.", 503)
      data = JSON.parse(fs.readFileSync(fd, "utf8"))
    } finally {
      fs.closeSync(fd)
    }
    if (
      !Array.isArray(data.vagas) ||
      !Array.isArray(data.status) ||
      new Set(data.vagas.map((j) => j.id)).size !== data.vagas.length ||
      data.vagas.some(
        (j) =>
          !j.id || !Array.isArray(j.historico) || !allowedStatuses.has(j.status)
      )
    )
      throw new BoardError("Dados do quadro de teste inválidos.", 503)
    return {
      ...data,
      demo: false,
      contagem: data.vagas.reduce<Record<string, number>>(
        (counts, j) => {
          counts[j.status] = (counts[j.status] || 0) + 1
          return counts
        },
        Object.fromEntries(data.status.map((s) => [s, 0]))
      ),
    }
  }
  function move(value: unknown): BoardPayload {
    const { id, status } = validateTransition(value)
    // An exclusive lock prevents two local processes from losing a movement.
    const lock = filename + ".lock"
    let lockFd: number
    try {
      lockFd = fs.openSync(lock, "wx", 0o600)
    } catch {
      throw new BoardError("O quadro está sendo salvo. Tente novamente.", 409)
    }
    const temp = path.join(
      path.dirname(filename),
      `.${path.basename(filename)}.${randomUUID()}.tmp`
    )
    try {
      const data = read()
      if (!data.status.includes(status)) throw new BoardError("Fase inválida.")
      const job = data.vagas.find((j) => j.id === id)
      if (!job) throw new BoardError("Vaga não encontrada.", 404)
      if (job.status === status) return data
      job.historico.push({
        em: new Date().toISOString(),
        de: job.status,
        para: status,
        por: "pessoa",
      })
      job.status = status
      const fd = fs.openSync(temp, "wx", 0o600)
      try {
        fs.writeFileSync(fd, JSON.stringify(data, null, 2) + "\n")
        fs.fsyncSync(fd)
      } finally {
        fs.closeSync(fd)
      }
      safeFile(filename)
      fs.renameSync(temp, filename)
      const dirFd = fs.openSync(path.dirname(filename), "r")
      try {
        fs.fsyncSync(dirFd)
      } finally {
        fs.closeSync(dirFd)
      }
      return read()
    } finally {
      if (fs.existsSync(temp)) fs.unlinkSync(temp)
      fs.closeSync(lockFd)
      fs.unlinkSync(lock)
    }
  }
  return { read, move }
}

const demoStore = createDemoStore()

async function proxy(
  path: "/api/vagas" | "/api/status",
  transition?: { id: string; status: string }
): Promise<BoardPayload> {
  const base = validateBackendUrl(process.env.JOBRELAY_API_URL || "")
  let response: Response
  try {
    response = await fetch(new URL(path, base), {
      method: transition ? "POST" : "GET",
      headers: transition ? { "content-type": "application/json" } : undefined,
      body: transition ? JSON.stringify(transition) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw new BoardError(
      "O servidor local não respondeu. Tente novamente.",
      502
    )
  }
  if (!response.ok)
    throw new BoardError(
      transition
        ? "Não foi possível mover a vaga. Tente novamente."
        : "Não foi possível carregar as vagas. Tente novamente.",
      response.status === 422 ? 422 : 502
    )
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new BoardError("Resposta inválida do servidor local.", 502)
  }
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as BoardPayload).vagas) ||
    !Array.isArray((data as BoardPayload).status)
  ) {
    throw new BoardError("Resposta inválida do servidor local.", 502)
  }
  return { ...(data as BoardPayload), demo: false }
}

export async function readBoard(): Promise<BoardPayload> {
  if (process.env.JOBRELAY_PROTOTYPE_FILE)
    return createFileStore(process.env.JOBRELAY_PROTOTYPE_FILE).read()
  return process.env.JOBRELAY_API_URL ? proxy("/api/vagas") : demoStore.read()
}

export async function moveJob(value: unknown): Promise<BoardPayload> {
  const transition = validateTransition(value)
  if (process.env.JOBRELAY_PROTOTYPE_FILE)
    return createFileStore(process.env.JOBRELAY_PROTOTYPE_FILE).move(transition)
  return process.env.JOBRELAY_API_URL
    ? proxy("/api/status", transition)
    : demoStore.move(transition)
}
