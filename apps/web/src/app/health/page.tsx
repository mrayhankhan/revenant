'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HealEvent {
  field: string;
  succeededAt: string;
  rowsRecovered: number;
  accuracy: number | null;
}

export default function HealthPage() {
  const [healEvents, setHealEvents] = useState<HealEvent[]>([]);
  const [stats, setStats] = useState({ totalHeals: 0, successRate: 0, avgAccuracy: 0 });

  useEffect(() => {
    Promise.all([
      fetch('/api/health/events').then((r) => r.json()),
      fetch('/api/health/stats').then((r) => r.json()),
    ])
      .then(([events, stats]) => {
        setHealEvents(events);
        setStats(stats);
      })
      .catch(console.error);
  }, []);

  const chartData = healEvents
    .slice(-30)
    .map((e) => ({
      date: new Date(e.succeededAt).toLocaleDateString(),
      accuracy: e.accuracy ? Math.round(e.accuracy * 100) : 0,
      recovered: e.rowsRecovered,
    }));

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Health Dashboard</h1>
        <p className="text-gray-600">
          Monitor collector health, heal events, and recovery accuracy.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Total Heals</div>
          <div className="mt-2 text-4xl font-bold">{stats.totalHeals}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Success Rate</div>
          <div className="mt-2 text-4xl font-bold text-live">{stats.successRate}%</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-sm font-medium text-gray-500">Avg Accuracy</div>
          <div className="mt-2 text-4xl font-bold text-live">{stats.avgAccuracy}%</div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Healing Timeline</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="accuracy" stroke="#10b981" name="Accuracy %" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-8 text-center text-gray-500">No healing events yet</div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent Heals</h2>
        {healEvents.length > 0 ? (
          <div className="space-y-2">
            {healEvents.slice(-10).map((event, i) => (
              <div key={i} className="flex items-center justify-between border-t border-gray-100 py-2 first:border-t-0">
                <div>
                  <p className="font-medium">{event.field}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(event.succeededAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {event.accuracy ? Math.round(event.accuracy * 100) : 0}%
                  </p>
                  <p className="text-xs text-gray-600">{event.rowsRecovered} recovered</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">No healing events yet</div>
        )}
      </div>
    </div>
  );
}
