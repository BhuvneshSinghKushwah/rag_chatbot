import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminKey = request.headers.get('x-admin-key');

  if (!adminKey) {
    return NextResponse.json({ error: 'Admin key required' }, { status: 401 });
  }

  const response = await fetch(`${API_URL}/api/admin/conversations/${id}`, {
    headers: { 'X-Admin-Key': adminKey },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
