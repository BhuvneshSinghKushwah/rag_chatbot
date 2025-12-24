import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || process.env.API_URL || 'http://localhost:8000',
  });
}
