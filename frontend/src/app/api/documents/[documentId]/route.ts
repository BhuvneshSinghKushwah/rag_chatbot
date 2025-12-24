import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL || 'http://localhost:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const response = await fetch(`${API_URL}/api/documents/${documentId}`);
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
