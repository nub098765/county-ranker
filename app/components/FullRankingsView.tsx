'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PersonalRating {
  elo: number;
  wins: number;
  losses: number;
  states: {
    id: string;
    name: string;
  };
}

export default function FullRankingsView({ userId }: { userId: string }) {
  const [rankings, setRankings] = useState<PersonalRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRankings() {
      const { data, error } = await supabase
        .from('user_state_ratings')
        .select('elo, wins, losses, state_id, states(id, name)')
        .eq('user_id', userId)
        .order('elo', { ascending: false });

      if (!error && data) {
        const mapped = data.map((row: any) => {
          const stateObj = Array.isArray(row.states) ? row.states[0] : row.states;
          return {
            elo: Math.round(row.elo ?? 1000),
            wins: row.wins ?? 0,
            losses: row.losses ?? 0,
            states: {
              id: stateObj?.id ?? row.state_id ?? `state-${Math.random()}`,
              name: stateObj?.name ?? row.state_name ?? row.name ?? 'Unknown State',
            },
          };
        });
        setRankings(mapped);
      }
      setLoading(false);
    }

    fetchRankings();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 my-8">
        <div className="animate-spin text-4xl mb-3">⚡</div>
        <p className="font-semibold text-lg">Calculating your full 50-state leaderboard...</p>
      </div>
    );
  }

  const top3 = rankings.slice(0, 3);
  const bottom3 = [...rankings].reverse().slice(0, 3);

  return (
    <div className="w-full max-w-4xl space-y-8 my-6">
      {/* Hero Banner */}
      <div className="bg-slate-800/90 border-2 border-indigo-500 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
        <div className="text-6xl mb-3">🎉</div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-indigo-400 mb-2">
          All 1,225 Matchups Completed!
        </h2>
        <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
          You evaluated every unique state pairing. Here is your official, personalized 50-state Elo ranking.
        </p>
      </div>

      {/* Top & Bottom Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Favorites */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-4 flex items-center justify-between">
            <span>🏆 Top Favorites</span>
            <span className="text-xs text-slate-400 font-normal">Rank #1 - #3</span>
          </h3>
          <div className="space-y-3">
            {top3.map((item, idx) => {
              const badges = ['🥇', '🥈', '🥉'];
              return (
                <div
                  key={item.states.id}
                  className="bg-slate-900/80 border border-emerald-500/30 rounded-lg p-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{badges[idx]}</span>
                    <span className="font-bold text-slate-100 text-lg">
                      {item.states.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-emerald-400 text-lg">
                      {item.elo} <span className="text-xs font-normal text-emerald-300">Elo</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.wins}W - {item.losses}L
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Least Favorites */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 mb-4 flex items-center justify-between">
            <span>📉 Least Favorites</span>
            <span className="text-xs text-slate-400 font-normal">Bottom 3</span>
          </h3>
          <div className="space-y-3">
            {bottom3.map((item, idx) => (
              <div
                key={item.states.id}
                className="bg-slate-900/80 border border-rose-500/30 rounded-lg p-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-400 text-base w-6">
                    #{rankings.length - idx}
                  </span>
                  <span className="font-bold text-slate-100 text-lg">
                    {item.states.name}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-rose-400 text-lg">
                    {item.elo} <span className="text-xs font-normal text-rose-300">Elo</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {item.wins}W - {item.losses}L
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Complete Standings Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📊</span> Complete 50-State Standings
          </h3>
          <span className="text-xs font-medium text-indigo-300 bg-indigo-950 border border-indigo-800 px-3 py-1 rounded-full">
            50 / 50 Evaluated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">State</th>
                <th className="py-2.5 px-3 text-right">Personal Elo</th>
                <th className="py-2.5 px-3 text-right">Record (W-L)</th>
                <th className="py-2.5 px-3 text-right">Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-slate-200">
              {rankings.map((item, idx) => {
                const totalMatches = item.wins + item.losses;
                const winPct = totalMatches > 0 ? Math.round((item.wins / totalMatches) * 100) : 0;

                return (
                  <tr
                    key={item.states.id}
                    className="hover:bg-slate-700/40 transition-colors font-medium"
                  >
                    <td className="py-3 px-3 font-mono text-slate-400 font-bold">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {item.states.name}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-indigo-300">
                      {item.elo}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {item.wins}W - {item.losses}L
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {winPct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}