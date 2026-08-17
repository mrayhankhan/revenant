import { NextResponse } from 'next/server';

// Mock heal events for demo
const MOCK_HEAL_EVENTS = [
  {
    field: 'title',
    succeededAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    rowsRecovered: 142,
    accuracy: 0.98,
  },
  {
    field: 'location',
    succeededAt: new Date(Date.now() - 1.5 * 86_400_000).toISOString(),
    rowsRecovered: 89,
    accuracy: 0.95,
  },
  {
    field: 'salaryMin',
    succeededAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    rowsRecovered: 56,
    accuracy: 0.92,
  },
  {
    field: 'descriptionHtml',
    succeededAt: new Date(Date.now() - 0.5 * 86_400_000).toISOString(),
    rowsRecovered: 201,
    accuracy: 0.94,
  },
];

export async function GET() {
  return NextResponse.json(MOCK_HEAL_EVENTS);
}
