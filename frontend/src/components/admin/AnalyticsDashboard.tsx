'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/hooks';
import { adminApi, AnalyticsResponse } from '@/services/api';

export function AnalyticsDashboard() {
  const { adminKey } = useAdmin();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!adminKey) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const analytics = await adminApi.getAnalytics(adminKey, days);
        setData(analytics);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      }
      setIsLoading(false);
    };

    fetchData();
  }, [adminKey, days]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-neutral-800 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-neutral-800 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const maxMessages = Math.max(...data.daily.map((d) => d.messages), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Usage Analytics</h3>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-2 bg-neutral-800 border border-neutral-700 text-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Messages"
          value={data.summary.total_messages}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
        />
        <StatCard
          label="Conversations"
          value={data.summary.total_conversations}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          }
        />
        <StatCard
          label="Unique Users"
          value={data.summary.unique_users}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
      </div>

      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-4">Daily Messages</h4>
        <div className="h-48 flex items-end gap-1">
          {data.daily.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group">
              <div
                className="w-full bg-blue-500 rounded-t hover:bg-blue-400 transition-colors cursor-pointer"
                style={{ height: `${(day.messages / maxMessages) * 100}%`, minHeight: day.messages > 0 ? '4px' : '0' }}
                title={`${day.date}: ${day.messages} messages`}
              />
              {i % 7 === 0 && (
                <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 flex items-center gap-4">
      <div className="p-3 bg-blue-600/20 text-blue-400 rounded-lg">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </div>
  );
}
