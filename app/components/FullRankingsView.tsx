'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface StandingItem {
  id: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
}

export default function FullRankingsView() {
  const [standings, setStandings] = useState<StandingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStandings() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_state_ratings')
        .select('elo, wins, losses, state_id, states(id, name)')
        .eq('user_id', user.id)
        .order('elo', { ascending: false });

      if (error) {
        console.error('Error fetching standings:', error);
      } else if (data) {
        const mapped = data.map((row: any) => {
          const stateObj = Array.isArray(row.states) ? row.states[0] : row.states;
          return {
            id: stateObj?.id ?? row.state_id ?? `state-${Math.random()}`,
            name: stateObj?.name ?? 'Unknown State',
            elo: Number(row.elo ?? 1000),
            wins: row.wins ?? 0,
            losses: row.losses ?? 0,
          };
        });
        setStandings(mapped);
      }
      setLoading(false);
    }

    fetchStandings();
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-slate-950 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        Loading standings...
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <div className="w-full bg-slate-950 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        No rankings recorded yet.
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-xl max-h-96 overflow-y-auto">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700 text-xs font-semibold uppercase tracking-wider text-slate-400 sticky top-0 z-10">
              <th className="py-3 px-4 w-16">Rank</th>
              <th className="py-3 px-4">State</th>
              <th className="py-3 px-4 text-center">Record</th>
              <th className="py-3 px-4 text-right">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-sm">
            {standings.map((item, idx) => (
              <tr 
                key={item.id} 
                className="hover:bg-slate-900/60 transition-colors"
              >
                <td className="py-3 px-4 font-mono font-semibold text-slate-400">
                  #{idx + 1}
                </td>
                <td className="py-3 px-4 font-medium text-slate-100">
                  {item.name}
                </td>
                <td className="py-3 px-4 text-center text-slate-400 text-xs font-mono">
                  {item.wins}W - {item.losses}L
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300">
                  {item.elo.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}