import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const adminKey = request.headers.get('x-admin-key');
  const { providerId } = await params;

  if (!adminKey) {
    return NextResponse.json({ error: 'Admin key required' }, { status: 401 });
  }

  const body = await request.json();

  const response = await fetch(`${API_URL}/api/admin/llm/providers/${providerId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const adminKey = request.headers.get('x-admin-key');
  const { providerId } = await params;

  if (!adminKey) {
    return NextResponse.json({ error: 'Admin key required' }, { status: 401 });
  }

  const response = await fetch(`${API_URL}/api/admin/llm/providers/${providerId}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Key': adminKey },
  });

  if (response.status === 204 || response.ok) {
    return NextResponse.json({ message: 'Provider deleted' });
  }

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
