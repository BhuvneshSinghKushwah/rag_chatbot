import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days') || '30';
  const limit = searchParams.get('limit') || '10';

  if (!adminKey) {
    return NextResponse.json({ error: 'Admin key required' }, { status: 401 });
  }

  const response = await fetch(`${API_URL}/api/admin/analytics/top-users?days=${days}&limit=${limit}`, {
    headers: { 'X-Admin-Key': adminKey },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
