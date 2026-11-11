import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createFileStore, createDemoStore } from "./server-store.ts"

const testRoot = path.resolve(".local-tests")
fs.mkdirSync(testRoot, { recursive: true })
function fixture() {
  const dir = fs.mkdtempSync(path.join(testRoot, "board-"))
  const file = path.join(dir, "quadro.json")
  fs.writeFileSync(file, JSON.stringify(createDemoStore().read()))
  return { dir, file }
}

test("movement is durable in a fresh Node process and metadata/history are preserved", () => {
  const { dir, file } = fixture()
  try {
    const before = createFileStore(file).read()
    const id = before.vagas[0]!.id
    const moved = createFileStore(file).move({ id, status: "Aplicar" })
    assert.equal(moved.vagas.length, before.vagas.length)
    assert.equal(moved.vagas[0]!.titulo, before.vagas[0]!.titulo)
    const child = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import {createFileStore} from './src/lib/server-store.ts'; process.stdout.write(JSON.stringify(createFileStore(process.argv[1]).read()))`,
        file,
      ],
      { encoding: "utf8" }
    )
    assert.equal(child.status, 0, child.stderr)
    const reopened = JSON.parse(child.stdout)
    assert.equal(reopened.vagas[0].status, "Aplicar")
    assert.deepEqual(
      reopened.vagas[0].historico.at(-1),
      moved.vagas[0]!.historico.at(-1)
    )
    const history = moved.vagas[0]!.historico.length
    assert.equal(
      createFileStore(file).move({ id, status: "Aplicar" }).vagas[0]!.historico
        .length,
      history
    )
    createFileStore(file).move({ id: moved.vagas[1]!.id, status: "Entrevista" })
    assert.equal(createFileStore(file).read().vagas[0]!.status, "Aplicar")
  } finally {
    fs.rmSync(dir, { recursive: true })
  }
})

test("unknown job/status and write lock preserve state; atomic writes preserve linked backups", () => {
  const { dir, file } = fixture()
  try {
    const before = fs.readFileSync(file, "utf8")
    const store = createFileStore(file)
    assert.throws(() => store.move({ id: "missing", status: "Aplicar" }))
    assert.throws(() => store.move({ id: "demo:aurora", status: "unknown" }))
    fs.writeFileSync(file + ".lock", "")
    assert.throws(
      () => store.move({ id: "demo:aurora", status: "Aplicar" }),
      /sendo salvo/
    )
    fs.unlinkSync(file + ".lock")
    fs.linkSync(file, path.join(dir, "linked.json"))
    assert.equal(store.read().vagas.length, 5)
    store.move({ id: "demo:aurora", status: "Aplicar" })
    assert.equal(store.read().vagas[0]!.status, "Aplicar")
    assert.equal(fs.readFileSync(path.join(dir, "linked.json"), "utf8"), before)
    assert.equal(fs.statSync(file).nlink, 1)
    assert.equal(fs.existsSync(file + ".lock"), false)
  } finally {
    fs.rmSync(dir, { recursive: true })
  }
})
