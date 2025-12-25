import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');

  if (!adminKey) {
    return NextResponse.json({ error: 'Admin key required' }, { status: 401 });
  }

  const response = await fetch(`${API_URL}/api/admin/analytics/usage?days=1`, {
    headers: { 'X-Admin-Key': adminKey },
  });

  if (response.ok) {
    return NextResponse.json({ valid: true });
  }

  return NextResponse.json({ error: 'Invalid admin key' }, { status: 403 });
}
