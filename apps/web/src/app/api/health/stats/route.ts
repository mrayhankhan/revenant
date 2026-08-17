import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    totalHeals: 4,
    successRate: 96,
    avgAccuracy: 95,
    lastHeal: new Date(Date.now() - 0.5 * 86_400_000).toISOString(),
    uptime: 99.8,
  });
}
