import { NextResponse } from 'next/server'

export const successResponse = <T>(data: T, status = 200) =>
  NextResponse.json(
    { data, meta: { timestamp: new Date().toISOString() } },
    { status }
  )

export const errorResponse = (code: string, message: string, status = 400) =>
  NextResponse.json(
    { error: { code, message } },
    { status }
  )
