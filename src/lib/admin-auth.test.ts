import { describe, it, expect, beforeAll } from 'vitest'
import { signAdminCookie, isValidAdminCookie } from './admin-auth'

beforeAll(() => { process.env.ADMIN_COOKIE_SECRET = 'secreto-cookie' })

describe('cookie de administración', () => {
  it('acepta la cookie que ella misma firma', () => {
    expect(isValidAdminCookie(signAdminCookie())).toBe(true)
  })

  it('rechaza una cookie inventada', () => {
    expect(isValidAdminCookie('lo-que-sea')).toBe(false)
  })

  it('rechaza la ausencia de cookie', () => {
    expect(isValidAdminCookie(undefined)).toBe(false)
  })

  it('rechaza una firma alterada', () => {
    const cookie = signAdminCookie()
    expect(isValidAdminCookie(`${cookie}x`)).toBe(false)
  })
})
