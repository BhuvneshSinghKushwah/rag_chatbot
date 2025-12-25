import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  const adminKey = request.headers.get('x-admin-key');
  const { modelId } = await params;

  if (!adminKey) {
    return NextResponse.json({ error: 'Admin key required' }, { status: 401 });
  }

  const response = await fetch(`${API_URL}/api/admin/llm/models/${modelId}/default`, {
    method: 'PATCH',
    headers: { 'X-Admin-Key': adminKey },
  });

  if (response.ok) {
    return NextResponse.json({ message: 'Default model updated' });
  }

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
