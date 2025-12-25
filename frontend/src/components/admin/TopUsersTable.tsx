'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/hooks';
import { adminApi, TopUsersResponse } from '@/services/api';

export function TopUsersTable() {
  const { adminKey } = useAdmin();
  const [data, setData] = useState<TopUsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!adminKey) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const result = await adminApi.getTopUsers(adminKey, days, 10);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      }
      setIsLoading(false);
    };

    fetchData();
  }, [adminKey, days]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-10 bg-neutral-800 rounded" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-neutral-800 rounded" />
        ))}
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

  const users = data?.users || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Top Users</h3>
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

      <div className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead className="bg-neutral-900">
            <tr>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Msgs
              </th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Convs
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 sm:px-4 py-8 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user, i) => (
                <tr key={user.user_id} className="hover:bg-neutral-750">
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium flex-shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-xs sm:text-sm text-gray-200 font-mono truncate max-w-[80px] sm:max-w-none">
                        {user.user_id.slice(0, 8)}...
                      </span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-300">
                    {user.message_count.toLocaleString()}
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-300">
                    {user.conversation_count.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
