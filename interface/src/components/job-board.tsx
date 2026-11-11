import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  closestCorners,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core"
import {
  ArrowSquareOutIcon,
  ArrowsLeftRightIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CircleIcon,
  PaperPlaneTiltIcon,
  RobotIcon,
  ChatsCircleIcon,
  ProhibitIcon,
  FlagIcon,
  ClockCounterClockwiseIcon,
  CalendarBlankIcon,
  FileTextIcon,
  GlobeHemisphereWestIcon,
  KanbanIcon,
  MagnifyingGlassIcon,
  MoneyIcon,
  SpinnerGapIcon,
  TableIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet"
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import {
  scoreTone,
  locationLabel,
  type Job,
  type BoardPayload,
  type History,
} from "@/lib/jobs"

import { compatibilityItems } from "@/lib/gaps"

// Cores conferidas no campo Status do Quadro de Vagas no Notion.
const stageVisuals = {
  Avaliar: { icon: MagnifyingGlassIcon, tone: "blue" },
  Aplicar: { icon: PaperPlaneTiltIcon, tone: "red" },
  "Aplicado por IA": { icon: RobotIcon, tone: "orange" },
  "Já apliquei": { icon: CheckCircleIcon, tone: "green" },
  Entrevista: { icon: ChatsCircleIcon, tone: "purple" },
  Cancelada: { icon: ProhibitIcon, tone: "gray" },
  Revisar: { icon: WarningCircleIcon, tone: "red" },
  Priorizar: { icon: FlagIcon, tone: "orange" },
} as const
function StageLabel({ stage }: { stage: string }) {
  const visual = stageVisuals[stage as keyof typeof stageVisuals]
  const Icon = visual?.icon ?? CircleIcon
  return (
    <span className={`stage-label stage-${visual?.tone ?? "gray"}`}>
      <span className="stage-icon" aria-hidden="true">
        <Icon weight="duotone" />
      </span>
      <span>{stage}</span>
    </span>
  )
}
const safeHref = (value?: string | null) => {
  try {
    const u = new URL(value || "")
    return ["https:", "http:"].includes(u.protocol) ? u.href : undefined
  } catch {
    return undefined
  }
}
const safeLogo = (value?: string | null) =>
  value?.match(
    /^data:image\/(?:svg\+xml|png|jpeg|webp|x-icon|vnd.microsoft.icon);base64,[A-Za-z0-9+/=]+$/
  )
    ? value
    : safeHref(value)
const initials = (name?: string | null) =>
  String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
function CompanyLogo({
  job,
  size = "normal",
  logoOnly = false,
}: {
  job: Job
  size?: "normal" | "large"
  logoOnly?: boolean
}) {
  const src = safeLogo(job.logo)
  const [failedSrc, setFailedSrc] = useState<string>()
  if (logoOnly && (!src || failedSrc === src)) return null
  return (
    <Avatar
      className={`company-logo ${size === "large" ? "large" : ""}`}
      style={
        job.logoBackground?.match(/^#[0-9a-f]{6}$/i)
          ? { backgroundColor: job.logoBackground }
          : undefined
      }
    >
      <AvatarImage
        src={src}
        onError={() => setFailedSrc(src)}
        alt={job.empresa || "Empresa não informada"}
        style={{ objectFit: "contain", padding: job.logoBackground ? 3 : 0 }}
      />
      {!logoOnly && <AvatarFallback>{initials(job.empresa)}</AvatarFallback>}
    </Avatar>
  )
}
function Score({ job, label = false }: { job: Job; label?: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={`score score-${scoreTone(job)}`}
      title={job.lida === false ? "Leitura pendente" : "Compatibilidade"}
    >
      <span className="score-dot" />
      {job.compatibilidade == null
        ? "Sem avaliação"
        : `${Math.round(job.compatibilidade)}%`}
      {label && job.compatibilidade != null && " compatibilidade"}
      {job.lida === false && <span className="score-partial">· parcial</span>}
    </Badge>
  )
}
function Metadata({ job }: { job: Job }) {
  return (
    <div className="metadata">
      {job.salario && job.salario !== "—" && (
        <Badge variant="secondary" className="meta-chip salary">
          <MoneyIcon />
          {job.salario}
        </Badge>
      )}
      <div className="meta-second">
        {locationLabel(job) && (
          <Badge
            variant="secondary"
            className="meta-chip"
            title={locationLabel(job)}
          >
            <GlobeHemisphereWestIcon />
            {locationLabel(job)}
          </Badge>
        )}
        {job.senioridade && (
          <Badge variant="secondary" className="meta-chip">
            <ChartBarIcon />
            {job.senioridade}
          </Badge>
        )}
      </div>
    </div>
  )
}
function CardBody({ job, ghost = false }: { job: Job; ghost?: boolean }) {
  return (
    <Card className={`job-card ${ghost ? "drag-card" : ""}`}>
      <CardContent className="job-card-content">
        <div className="card-heading">
          <CompanyLogo job={job} />
          <span className="job-copy">
            <span className="job-name" title={job.titulo}>
              {job.titulo}
            </span>
            <span className="company-name" title={job.empresa}>
              {job.empresa}
            </span>
          </span>
        </div>
        <Metadata job={job} />
        <div className="card-bottom">
          <Score job={job} label />
          <Progress
            value={
              job.compatibilidade == null
                ? 0
                : Math.max(0, Math.min(100, job.compatibilidade))
            }
            aria-label="Compatibilidade"
            className={`card-progress tone-${scoreTone(job)}`}
          />
        </div>
      </CardContent>
    </Card>
  )
}
function DraggableJob({
  job,
  onOpen,
  disabled,
}: {
  job: Job
  onOpen: () => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: job.id, disabled })
  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        setActivatorNodeRef(node)
      }}
      className={`draggable-job ${isDragging ? "drag-placeholder" : ""}`}
      data-job-id={job.id}
      data-job-open={job.id}
      {...attributes}
      {...listeners}
      tabIndex={0}
      aria-label={`Detalhes de ${job.titulo}`}
      aria-haspopup="dialog"
      aria-keyshortcuts="Enter Space"
      onClick={() => {
        if (!isDragging) onOpen()
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          onOpen()
        } else listeners?.onKeyDown?.(event)
      }}
    >
      <CardBody job={job} />
    </div>
  )
}
function Column({
  stage,
  jobs,
  onOpen,
  dragging,
  pending,
}: {
  stage: string
  jobs: Job[]
  onOpen: (id: string) => void
  dragging: boolean
  pending: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver && dragging ? "drop-active" : ""}`}
      data-stage={stage}
      aria-label={stage}
    >
      <h2 className="column-title">
        <StageLabel stage={stage} />
        <span className="column-count">{jobs.length}</span>
      </h2>
      <div className="column-cards">
        {jobs.map((job) => (
          <DraggableJob
            key={job.id}
            job={job}
            onOpen={() => onOpen(job.id)}
            disabled={pending}
          />
        ))}
        {jobs.length === 0 && (
          <div className="column-empty">
            {dragging ? "Solte para mover" : "Nenhuma vaga nesta fase"}
          </div>
        )}
        {dragging && jobs.length > 0 && (
          <div className="drop-hint">Solte para mover</div>
        )}
      </div>
    </section>
  )
}
function StageSelect({
  value,
  stages,
  onChange,
  disabled,
  label,
}: {
  value: string
  stages: string[]
  onChange: (stage: string) => void
  disabled: boolean
  label: string
}) {
  const options = [...new Set([...stages, value])]
  return (
    <Select
      value={value}
      onValueChange={(value) => {
        if (value) onChange(value)
      }}
      disabled={disabled}
      items={options.map((s) => ({ value: s, label: s }))}
    >
      <SelectTrigger className="stage-select" aria-label={label}>
        <SelectValue>
          <StageLabel stage={value} />
        </SelectValue>
        {disabled && <SpinnerGapIcon className="animate-spin" />}
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {options.map((s) => (
          <SelectItem key={s} value={s}>
            <StageLabel stage={s} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
const actor = (name: string) =>
  ({
    pessoa: "Você",
    agente: "Assistente",
    rodada: "Coleta",
    notion: "Notion",
  })[name] ||
  name ||
  "Autor não registrado"
function eventDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Data não registrada"
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(date)
}
function Timeline({ history }: { history: History[] }) {
  return history.length ? (
    <ol className="timeline">
      {[...history].reverse().map((event, index) => (
        <li key={`${event.em}-${index}`}>
          <span className="timeline-dot">
            {event.de ? <ArrowsLeftRightIcon /> : <CheckCircleIcon />}
          </span>
          <div>
            <div className="event-label">
              {event.de
                ? `${event.de} → ${event.para}`
                : `Adicionada em ${event.para}`}
            </div>
            <time className="event-date" dateTime={event.em}>
              {eventDate(event.em)}
            </time>
            <div className="event-actor">{actor(event.por)}</div>
          </div>
        </li>
      ))}
    </ol>
  ) : (
    <p className="muted">Sem alterações registradas</p>
  )
}
function DetailSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="detail-section">
      <h3>
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}
function DetailField({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  const content = value?.trim()
  if (!content || ["-", "—", "–"].includes(content)) return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{content}</dd>
    </>
  )
}
function detailDate(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}
function ReadableText({ text }: { text: string }) {
  return (
    <div className="detail-prose">
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
    </div>
  )
}
function GapText({ job }: { job: Job }) {
  const items = compatibilityItems(job)
  return items.length ? (
    <ul className="compatibility-checklist">
      {items.map((item, index) => (
        <li key={index}>
          <span aria-hidden="true">
            {item.estado === "atendido" ? "✅" : "🚫"}
          </span>
          <span>
            {item.requisito}
            <span
              className={
                item.estado === "atendido" ? "sr-only" : "compatibility-state"
              }
            >
              {item.estado === "atendido"
                ? " · Atende"
                : item.estado === "lacuna"
                  ? " · Lacuna"
                  : " · Não comprovado"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="muted">Compatibilidade por requisito ainda não registrada.</p>
  )
}
const keyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context }
) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft")
    return undefined
  event.preventDefault()
  const columns = [...context.droppableRects.entries()].sort(
    (a, b) => a[1].left - b[1].left
  )
  const current = columns.findIndex(([id]) => id === context.over?.id)
  const target = columns[current + (event.code === "ArrowRight" ? 1 : -1)]?.[1]
  const dragged = context.collisionRect
  if (current < 0 || !target || !dragged) return currentCoordinates
  return {
    ...currentCoordinates,
    x:
      currentCoordinates.x +
      target.left +
      target.width / 2 -
      dragged.left -
      dragged.width / 2,
  }
}
const collisionDetection: CollisionDetection = (args) => {
  const hit = pointerWithin(args)
  return hit.length ? hit : closestCorners(args)
}

export default function JobBoard() {
  const [data, setData] = useState<BoardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"board" | "table">("board")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const lock = useRef(false)
  const returnId = useRef<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      keyboardCodes: { start: ["Space"], end: ["Space"], cancel: ["Escape"] },
    })
  )
  async function load() {
    setLoading(true)
    setError(false)
    try {
      const r = await fetch("/api/vagas")
      if (!r.ok) throw Error()
      setData(await r.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    fetch("/api/vagas", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error()
        return r.json() as Promise<BoardPayload>
      })
      .then((next) => {
        if (cancelled) return
        setData(next)
        try {
          if (localStorage.getItem("jobrelay-view") === "table")
            setView("table")
        } catch {
          /* A visualização padrão continua disponível. */
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])
  function open(id: string) {
    returnId.current = id
    returnFocus.current = document.activeElement as HTMLElement
    setMoveError(null)
    setSelectedId(id)
  }
  function close() {
    setSelectedId(null)
    setMoveError(null)
  }
  async function move(id: string, stage: string) {
    const current = data?.vagas.find((j) => j.id === id)
    if (!current || current.status === stage || lock.current) return
    lock.current = true
    setPending(id)
    setMoveError(null)
    try {
      const r = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: stage }),
      })
      if (!r.ok) throw Error()
      const next: BoardPayload = await r.json()
      setData(next)
      toast.success(`Movida para ${stage}`)
    } catch {
      setMoveError("Não foi possível mover a vaga. Tente novamente.")
      toast.error("Não foi possível mover a vaga. Tente novamente.")
    } finally {
      lock.current = false
      setPending(null)
    }
  }
  function dragEnd(event: DragEndEvent) {
    setActiveId(null)
    if (event.over)
      void move(String(event.active.id), String(event.over.id)).then(() =>
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(
              `[data-job-id="${CSS.escape(String(event.active.id))}"]`
            )
            ?.focus()
        )
      )
  }
  const jobs = data?.vagas || []
  const stages = data?.status || []
  const list = jobs.filter((j) =>
    `${j.titulo} ${j.empresa}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR"))
  )
  const selected = jobs.find((j) => j.id === selectedId)
  const active = jobs.find((j) => j.id === activeId)
  function setMode(mode: "board" | "table") {
    setView(mode)
    try {
      localStorage.setItem("jobrelay-view", mode)
    } catch {
      /* Preferência opcional. */
    }
  }
  return (
    <>
      <header className="app-header">
        <h1>
          JobRelay <span>/ Quadro</span>
        </h1>
        <div className="header-actions">
          <div className="search-field">
            <MagnifyingGlassIcon />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar vaga ou empresa"
              aria-label="Buscar vaga ou empresa"
            />
          </div>
          <div className="view-switch" role="group" aria-label="Visualização">
            <Button
              variant={view === "board" ? "outline" : "ghost"}
              onClick={() => setMode("board")}
              aria-pressed={view === "board"}
            >
              <KanbanIcon />
              Quadro
            </Button>
            <Button
              variant={view === "table" ? "outline" : "ghost"}
              onClick={() => setMode("table")}
              aria-pressed={view === "table"}
            >
              <TableIcon />
              Tabela
            </Button>
          </div>
        </div>
      </header>
      <main className="app-main">
        {loading ? (
          <div className="board-scroll">
            <div className="board-grid">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i}>
                  <Skeleton className="mb-5 h-4 w-24" />
                  <Skeleton className="h-56 w-80" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="empty-state" role="alert">
            <WarningCircleIcon />
            <p>Não foi possível carregar as vagas.</p>
            <Button variant="outline" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <BriefcaseIcon />
            <p>Peça ao assistente para buscar vagas.</p>
          </div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <MagnifyingGlassIcon />
            <p>Nenhuma vaga encontrada.</p>
            <Button variant="outline" onClick={() => setQuery("")}>
              Limpar busca
            </Button>
          </div>
        ) : view === "board" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={(e) => {
              setActiveId(String(e.active.id))
              setMoveError(null)
            }}
            onDragEnd={dragEnd}
            onDragCancel={() => setActiveId(null)}
            accessibility={{
              screenReaderInstructions: {
                draggable:
                  "Pressione Enter para abrir os detalhes ou espaço para arrastar. Use as setas esquerda e direita para escolher uma fase. Pressione espaço para soltar ou Escape para cancelar.",
              },
              announcements: {
                onDragStart: () => "Vaga selecionada para mover.",
                onDragOver: ({ over }) =>
                  over ? `Mover para ${over.id}.` : "Escolha uma fase.",
                onDragEnd: ({ over }) =>
                  over ? `Solta em ${over.id}.` : "Movimento cancelado.",
                onDragCancel: () => "Movimento cancelado.",
              },
            }}
          >
            <div className={`board-scroll ${active ? "is-dragging" : ""}`}>
              <div className="board-grid">
                {stages.map((stage) => (
                  <Column
                    key={stage}
                    stage={stage}
                    jobs={list.filter(
                      (j) =>
                        j.status === stage ||
                        (stage === "Já apliquei" &&
                          !stages.includes("Aplicado por IA") &&
                          j.status === "Aplicado por IA")
                    )}
                    onOpen={open}
                    dragging={!!active}
                    pending={!!pending}
                  />
                ))}
              </div>
            </div>
            <DragOverlay dropAnimation={{ duration: 160, easing: "ease-out" }}>
              {active ? <CardBody job={active} ghost /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="jobs-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oportunidade</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Senioridade</TableHead>
                  <TableHead>Compatibilidade</TableHead>
                  <TableHead>Fase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <button
                        className="table-job"
                        data-job-open={job.id}
                        onClick={() => open(job.id)}
                      >
                        <CompanyLogo job={job} />
                        <span className="table-job-text">
                          <span className="job-name" title={job.titulo}>
                            {job.titulo}
                          </span>
                          <span className="company-name">{job.empresa}</span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="salary-cell">
                      {job.salario && job.salario !== "—"
                        ? job.salario
                        : "Não informado"}
                    </TableCell>
                    <TableCell>
                      <span className="location-cell">
                        <GlobeHemisphereWestIcon />
                        {locationLabel(job) || "Não informada"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {job.senioridade ? (
                        <Badge variant="secondary" className="meta-chip">
                          <ChartBarIcon />
                          {job.senioridade}
                        </Badge>
                      ) : (
                        "Não informada"
                      )}
                    </TableCell>
                    <TableCell>
                      <Score job={job} />
                    </TableCell>
                    <TableCell>
                      <StageSelect
                        value={job.status}
                        stages={stages}
                        onChange={(stage) => void move(job.id, stage)}
                        disabled={!!pending}
                        label={`Fase de ${job.titulo}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {moveError && !selected && (
          <p role="alert" className="move-error">
            {moveError}
          </p>
        )}
      </main>
      <Sheet
        open={!!selected}
        onOpenChange={(isOpen) => {
          if (!isOpen) close()
        }}
      >
        <SheetContent
          showCloseButton={false}
          className="job-sheet"
          finalFocus={() =>
            document.querySelector<HTMLElement>(
              `[data-job-open="${CSS.escape(returnId.current || "")}"]`
            ) || returnFocus.current
          }
        >
          <div className="sheet-top">
            <span>Detalhes da vaga</span>
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="close-sheet"
                  aria-label="Fechar detalhes"
                />
              }
            >
              <XIcon />
            </SheetClose>
          </div>
          {selected && (
            <div className="sheet-body">
              <div className="sheet-company">
                <CompanyLogo job={selected} size="large" logoOnly />
                <span>{selected.empresa}</span>
              </div>
              <SheetTitle className="sheet-job-title">
                {selected.titulo}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detalhes de {selected.titulo} na {selected.empresa}
              </SheetDescription>
              <section
                className="match-box confidence-box"
                aria-label="Confiança"
              >
                <div className="match-heading">
                  <h3>Confiança</h3>
                  <span className="confidence-value">
                    {selected.compatibilidade == null ||
                    !Number.isFinite(selected.compatibilidade)
                      ? "Sem avaliação"
                      : `${Math.round(Math.max(0, Math.min(100, selected.compatibilidade)))}%`}
                  </span>
                </div>
                {selected.compatibilidade != null &&
                  Number.isFinite(selected.compatibilidade) && (
                    <Progress
                      value={Math.max(
                        0,
                        Math.min(100, selected.compatibilidade)
                      )}
                      aria-label="Confiança"
                      className="match-progress"
                    />
                  )}
                {selected.lida === false && (
                  <p className="muted partial-note">Leitura pendente</p>
                )}
              </section>
              <DetailSection title="Sobre a vaga" icon={<BriefcaseIcon />}>
                <dl className="job-properties">
                  <dt>Status</dt>
                  <dd>
                    <StageSelect
                      value={selected.status}
                      stages={stages}
                      onChange={(stage) => void move(selected.id, stage)}
                      disabled={!!pending}
                      label="Status da candidatura"
                    />
                  </dd>
                  <DetailField label="Empresa" value={selected.empresa} />
                  <DetailField label="Salário" value={selected.salario} />
                  <DetailField
                    label="Senioridade"
                    value={selected.senioridade}
                  />
                  <DetailField
                    label="Local e modelo"
                    value={locationLabel(selected)}
                  />
                  <DetailField label="Fonte" value={selected.fonte} />
                </dl>
                {safeHref(selected.link) && (
                  <Button
                    variant="outline"
                    className="detail-source-link"
                    nativeButton={false}
                    render={
                      <a
                        href={safeHref(selected.link)}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    Abrir anúncio
                    <ArrowSquareOutIcon />
                  </Button>
                )}
                {moveError && (
                  <p role="alert" className="move-error">
                    {moveError}
                  </p>
                )}
              </DetailSection>
              {selected.resumo?.trim() && (
                <DetailSection title="Resumo" icon={<FileTextIcon />}>
                  <ReadableText text={selected.resumo} />
                </DetailSection>
              )}
              <DetailSection title="Próxima ação" icon={<CheckCircleIcon />}>
                {selected.pendencia?.trim() ? (
                  <ReadableText text={selected.pendencia} />
                ) : (
                  <p className="muted">Nenhuma próxima ação registrada.</p>
                )}
              </DetailSection>
              <DetailSection title="Gaps" icon={<CheckCircleIcon />}>
                <GapText job={selected} />
              </DetailSection>
              <DetailSection title="Candidatura" icon={<PaperPlaneTiltIcon />}>
                {(selected.aplicadaEm ||
                  selected.resultado ||
                  selected.curriculo) && (
                  <dl className="job-properties">
                    <DetailField
                      label="Aplicada em"
                      value={detailDate(selected.aplicadaEm)}
                    />
                    <DetailField label="Resultado" value={selected.resultado} />
                    {selected.curriculo && (
                      <>
                        <dt>Currículo</dt>
                        <dd>
                          {safeHref(selected.curriculo) ? (
                            <a
                              href={safeHref(selected.curriculo)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir currículo <ArrowSquareOutIcon />
                            </a>
                          ) : (
                            selected.curriculo
                          )}
                        </dd>
                      </>
                    )}
                  </dl>
                )}
                <details className="detail-disclosure">
                  <summary>Dados técnicos</summary>
                  <dl className="job-properties">
                    <DetailField label="ID externo" value={selected.id} />
                    <DetailField
                      label="Currículo local"
                      value={selected.curriculoCaminho}
                    />
                  </dl>
                  {selected.gaps?.trim() && (
                    <div className="legacy-gap-notes">
                      <h4>Anotações anteriores</h4>
                      <ReadableText text={selected.gaps} />
                    </div>
                  )}
                </details>
              </DetailSection>
              <DetailSection title="Datas" icon={<CalendarBlankIcon />}>
                {selected.publicadaEm || selected.prazo ? (
                  <dl className="job-properties">
                    <DetailField
                      label="Publicada em"
                      value={detailDate(selected.publicadaEm)}
                    />
                    <DetailField
                      label="Prazo"
                      value={detailDate(selected.prazo)}
                    />
                  </dl>
                ) : (
                  <p className="muted">Nenhuma data registrada.</p>
                )}
              </DetailSection>
              <DetailSection
                title="Histórico"
                icon={<ClockCounterClockwiseIcon />}
              >
                <Timeline history={selected.historico} />
              </DetailSection>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Toaster
        theme="light"
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ closeButtonAriaLabel: "Fechar aviso" }}
        containerAriaLabel="Avisos"
      />
    </>
  )
}
