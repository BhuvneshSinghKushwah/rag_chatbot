import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = process.env.API_URL || 'http://localhost:8000';

function getForwardHeaders(request: NextRequest): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const forwardedFor = request.headers.get('x-forwarded-for') || request.ip || '';
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers['user-agent'] = userAgent;
  const acceptLang = request.headers.get('accept-language');
  if (acceptLang) headers['accept-language'] = acceptLang;
  return headers;
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: getForwardHeaders(request),
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
