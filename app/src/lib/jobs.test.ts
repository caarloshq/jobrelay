import test from "node:test"
import assert from "node:assert/strict"
import { locationLabel, scoreTone } from "./jobs.ts"
import {
  createDemoStore,
  validateBackendUrl,
  validateTransition,
} from "./server-store.ts"

const job = createDemoStore().read().vagas[0]!

test("score tones distinguish missing and partial scores before bands", () => {
  for (const [score, tone] of [
    [100, "high"],
    [75, "high"],
    [74, "medium"],
    [55, "medium"],
    [54, "low"],
    [0, "low"],
    [null, "none"],
    [Number.NaN, "none"],
  ] as const) {
    assert.equal(scoreTone({ ...job, compatibilidade: score }), tone)
  }
  assert.equal(
    scoreTone({ ...job, compatibilidade: 95, lida: false }),
    "partial"
  )
  assert.equal(
    scoreTone({ ...job, compatibilidade: null, lida: false }),
    "none"
  )
})

test("location label omits absent metadata and duplicate parts", () => {
  assert.equal(locationLabel({ ...job, modelo: null, localizacao: null }), "")
  assert.equal(
    locationLabel({ ...job, modelo: " Remoto ", localizacao: "Brasil" }),
    "Remoto · Brasil"
  )
  assert.equal(
    locationLabel({ ...job, modelo: "Brasil", localizacao: "Brasil" }),
    "Brasil"
  )
})

test("backend origin accepts only explicit loopback HTTP addresses", () => {
  for (const url of ["http://localhost:4182", "http://127.0.0.1:4182/"])
    assert.ok(validateBackendUrl(url))
  for (const url of [
    "https://localhost:4182",
    "http://example.com",
    "http://localhost.example.com",
    "http://127.0.0.2",
    "http://user:pass@localhost",
    "http://localhost/api",
    "http://localhost?url=x",
    "http://localhost#x",
    "not a URL",
  ]) {
    assert.throws(() => validateBackendUrl(url))
  }
})

test("transition validates ID boundaries and known status", () => {
  assert.deepEqual(
    validateTransition({ id: "x".repeat(256), status: "Aplicar" }),
    { id: "x".repeat(256), status: "Aplicar" }
  )
  for (const input of [
    null,
    [],
    {},
    { id: "", status: "Aplicar" },
    { id: " ", status: "Aplicar" },
    { id: "a\n", status: "Aplicar" },
    { id: "x".repeat(257), status: "Aplicar" },
    { id: "a", status: "unknown" },
  ]) {
    assert.throws(() => validateTransition(input))
  }
})

test("demo move preserves jobs, records one transition and is idempotent", () => {
  const store = createDemoStore()
  const before = store.read()
  assert.equal(before.vagas.length, 5)
  const id = before.vagas[0]!.id
  const after = store.move({ id, status: "Aplicar" })
  const moved = after.vagas.find((job) => job.id === id)!
  assert.equal(moved.status, "Aplicar")
  assert.equal(moved.historico.length, 2)
  assert.deepEqual(
    { ...moved.historico.at(-1), em: "" },
    { em: "", de: "Avaliar", para: "Aplicar", por: "pessoa" }
  )
  assert.ok(Number.isFinite(Date.parse(moved.historico.at(-1)!.em)))
  assert.equal(after.contagem.Avaliar, 0)
  assert.equal(after.contagem.Aplicar, 2)
  assert.equal(
    store.move({ id, status: "Aplicar" }).vagas[0]!.historico.length,
    2
  )
  assert.equal(before.vagas[0]!.status, "Avaliar")
  after.vagas[0]!.titulo = "external mutation"
  assert.notEqual(store.read().vagas[0]!.titulo, "external mutation")
  assert.throws(() => store.move({ id: "missing", status: "Aplicar" }))
  assert.throws(() => store.move({ id, status: "Aplicado por IA" }))
})

test("explicit remote titles show work model without inventing location", () => {
  for (const titulo of [
    "Work From Home Senior UX/UI Designer",
    "Senior Product Designer - Remote",
    "Product Designer remoto",
  ]) {
    assert.equal(
      locationLabel({ ...job, titulo, modelo: null, localizacao: null }),
      "Remoto"
    )
  }
  assert.equal(
    locationLabel({
      ...job,
      titulo: "Product Designer",
      modelo: null,
      localizacao: null,
    }),
    ""
  )
  assert.equal(
    locationLabel({
      ...job,
      titulo: "Product Designer Remoto",
      modelo: null,
      localizacao: "Remoto · Brasil",
    }),
    "Remoto · Brasil"
  )
  assert.equal(
    locationLabel({
      ...job,
      titulo: "Product Designer - Remote",
      modelo: "Híbrido",
      localizacao: "São Paulo",
    }),
    "Híbrido · São Paulo"
  )
})
