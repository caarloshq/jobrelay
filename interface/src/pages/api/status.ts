import type { APIRoute } from 'astro'
import { BoardError, moveJob } from '../../lib/server-store.ts'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ erro: 'Origem da solicitação inválida.' }, { status: 403 })
  }
  try {
    const text = await request.text()
    if (text.length > 16384) throw new BoardError('Solicitação inválida.')
    let body: unknown
    try { body = JSON.parse(text) } catch { throw new BoardError('Informe a vaga e a fase.') }
    return Response.json(await moveJob(body), { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return Response.json({ erro: error instanceof BoardError ? error.message : 'Não foi possível mover a vaga.' }, {
      status: error instanceof BoardError ? error.status : 500,
      headers: { 'cache-control': 'no-store' },
    })
  }
}
