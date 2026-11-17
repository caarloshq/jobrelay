import type { APIRoute } from 'astro'
import { BoardError, readBoard } from '../../lib/server-store.ts'

export const prerender = false

export const GET: APIRoute = async () => {
  try {
    return Response.json(await readBoard(), { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return Response.json({ erro: error instanceof BoardError ? error.message : 'Não foi possível carregar as vagas.' }, {
      status: error instanceof BoardError ? error.status : 500,
      headers: { 'cache-control': 'no-store' },
    })
  }
}
