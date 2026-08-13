import { describe, it, expect, beforeEach } from 'vitest'
import { saveMyRequest, listMyRequests, removeMyRequest } from './my-requests'

beforeEach(() => localStorage.clear())

const entry = { publicCode: 'ABC123', manageToken: 'tok', title: 'Agua', createdAt: '2026-08-13T10:00:00Z' }

describe('mis solicitudes', () => {
  it('guarda y recupera una solicitud', () => {
    saveMyRequest(entry)
    expect(listMyRequests()).toEqual([entry])
  })

  it('no duplica el mismo código', () => {
    saveMyRequest(entry)
    saveMyRequest({ ...entry, title: 'Agua y comida' })
    const all = listMyRequests()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('Agua y comida')
  })

  it('elimina una solicitud', () => {
    saveMyRequest(entry)
    removeMyRequest('ABC123')
    expect(listMyRequests()).toEqual([])
  })

  it('devuelve lista vacía si el almacenamiento tiene basura', () => {
    localStorage.setItem('reporta-cali:mis-solicitudes', 'no es json')
    expect(listMyRequests()).toEqual([])
  })

  it('devuelve lista vacía cuando no hay nada guardado', () => {
    expect(listMyRequests()).toEqual([])
  })
})
