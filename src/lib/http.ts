import { NextResponse } from 'next/server'

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 })
}

export function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status })
}

export const AUTH_REQUIRED = () => err('AUTH_REQUIRED', 'برای این عملیات باید وارد حساب شوید.', 401)

export function badRequest(message = 'درخواست نامعتبر است.') {
  return err('BAD_REQUEST', message, 400)
}
