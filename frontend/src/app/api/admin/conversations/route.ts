import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '50';
  const offset = searchParams.get('offset') || '0';
  const userId = searchParams.get('user_id');

  if (!adminKey) {
    return NextResponse.json({ error: 'Admin key required' }, { status: 401 });
  }

  let url = `${API_URL}/api/admin/conversations?limit=${limit}&offset=${offset}`;
  if (userId) {
    url += `&user_id=${userId}`;
  }

  const response = await fetch(url, {
    headers: { 'X-Admin-Key': adminKey },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
