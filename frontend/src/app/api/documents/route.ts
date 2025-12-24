import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function GET() {
  const response = await fetch(`${API_URL}/api/documents`, {
    cache: 'no-store',
  });
  const data = await response.json();

  return NextResponse.json(data, {
    status: response.status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
