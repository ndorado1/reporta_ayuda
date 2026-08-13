'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { ADMIN_COOKIE, checkAdminToken, isValidAdminCookie, signAdminCookie } from '@/lib/admin-auth'
import { setHidden } from '@/lib/requests'

export async function loginAction(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  if (!checkAdminToken(token)) redirect('/admin/login?error=1')

  const store = await cookies()
  store.set(ADMIN_COOKIE, signAdminCookie(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: 60 * 60 * 12,
  })
  redirect('/admin')
}

async function requireAdmin() {
  const store = await cookies()
  if (!isValidAdminCookie(store.get(ADMIN_COOKIE)?.value)) redirect('/admin/login')
}

export async function hideAction(code: string, hidden: boolean) {
  await requireAdmin()
  await setHidden(code, hidden)
  revalidatePath('/admin')
  revalidatePath('/')
}
