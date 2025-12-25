import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const adminKey = request.headers.get('x-admin-key');
  const { providerId } = await params;

  if (!adminKey) {
    return NextResponse.json({ error: 'Admin key required' }, { status: 401 });
  }

  const response = await fetch(`${API_URL}/api/admin/llm/providers/${providerId}/test`, {
    method: 'POST',
    headers: { 'X-Admin-Key': adminKey },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
