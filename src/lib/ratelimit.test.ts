import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { resetTestDb } from '@/test/db'
import { consumeRate, RATE_LIMITS } from './ratelimit'

beforeAll(() => { process.env.IP_HASH_SECRET = 'secreto-de-prueba' })
beforeEach(resetTestDb)

describe('consumeRate', () => {
  it('cuenta cada uso', async () => {
    expect((await consumeRate('1.1.1.1', 'create_request')).count).toBe(1)
    expect((await consumeRate('1.1.1.1', 'create_request')).count).toBe(2)
  })

  it('no marca exceso por debajo del umbral', async () => {
    const r = await consumeRate('1.1.1.1', 'create_request')
    expect(r.exceeded).toBe(false)
  })

  it('marca exceso al superar el umbral', async () => {
    const limit = RATE_LIMITS.create_request
    let last = { exceeded: false, count: 0 }
    for (let i = 0; i < limit + 1; i++) last = await consumeRate('1.1.1.1', 'create_request')
    expect(last.exceeded).toBe(true)
  })

  it('cuenta por separado cada acción', async () => {
    await consumeRate('1.1.1.1', 'create_request')
    expect((await consumeRate('1.1.1.1', 'contact')).count).toBe(1)
  })

  it('cuenta por separado cada IP', async () => {
    await consumeRate('1.1.1.1', 'create_request')
    expect((await consumeRate('2.2.2.2', 'create_request')).count).toBe(1)
  })
})
