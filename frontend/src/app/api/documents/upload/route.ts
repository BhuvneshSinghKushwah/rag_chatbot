import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const adminKey = request.headers.get('X-Admin-Key') || '';

  const response = await fetch(`${API_URL}/api/documents/upload`, {
    method: 'POST',
    headers: { 'X-Admin-Key': adminKey },
    body: formData,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
