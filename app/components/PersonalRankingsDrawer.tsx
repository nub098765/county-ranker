'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Instantiated ONCE at module level to prevent infinite memory leaks
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

export default function PersonalRankingsDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [rankings, setRankings] = useState<PersonalRating[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPersonalRankings = async () => {
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
      console.error('Error fetching personal rankings:', error);
    } else if (data) {
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
  };

  useEffect(() => {
    if (isOpen) {
      fetchPersonalRankings();
    }
  }, [isOpen]);

  const top3 = rankings.slice(0, 3);
  const bottom3 = [...rankings].reverse().slice(0, 3);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-1/2 right-0 -translate-y-1/2 z-40 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-4 rounded-l-xl shadow-lg transition-all duration-200 flex items-center gap-1 group cursor-pointer"
      >
        <span className="[writing-mode:vertical-rl] font-semibold tracking-wider text-xs uppercase rotate-180">
          My Rankings
        </span>
        <span className="text-xs transition-transform group-hover:-translate-x-1">◀</span>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        />
      )}

      {/* Slide-out Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 sm:w-96 bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl z-50 transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <h2 className="font-bold text-lg text-indigo-400 flex items-center gap-2">
            <span className="text-base">🏆</span> My Personal Rankings
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="text-sm font-bold">✕</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex justify-center items-center h-40 text-slate-400">
              Loading your ratings...
            </div>
          ) : rankings.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <span className="text-2xl block mx-auto">⚠️</span>
              <p className="font-medium">No votes recorded yet!</p>
              <p className="text-xs text-slate-500">Vote on some matchups to build your personal ranking.</p>
            </div>
          ) : (
            <>
              {/* Personal Winners (Top 3) */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2 flex items-center justify-between">
                  <span>Your Top Favorites</span>
                  <span className="text-slate-500 text-[10px]">Rank #1 - #3</span>
                </h3>
                <div className="space-y-2">
                  {top3.map((item, idx) => (
                    <div
                      key={item.states.id}
                      className="bg-slate-800/80 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-slate-400 w-4">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-slate-100">
                          {item.states.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400 text-sm">
                          {item.elo} Elo
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.wins}W - {item.losses}L
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personal Losers (Bottom 3) */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-2 flex items-center justify-between">
                  <span>Your Least Favorites</span>
                  <span className="text-slate-500 text-[10px]">Bottom 3</span>
                </h3>
                <div className="space-y-2">
                  {bottom3.map((item, idx) => (
                    <div
                      key={item.states.id}
                      className="bg-slate-800/80 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-slate-400 w-4">
                          #{rankings.length - idx}
                        </span>
                        <span className="font-semibold text-slate-100">
                          {item.states.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-rose-400 text-sm">
                          {item.elo} Elo
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.wins}W - {item.losses}L
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complete List Table */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Full Standings ({rankings.length}/50 Seen)
                </h3>
                <div className="bg-slate-950 border border-slate-800 rounded-lg divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
                  {rankings.map((item, idx) => (
                    <div
                      key={item.states.id}
                      className="px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-900/50"
                    >
                      <span className="text-slate-400 font-mono w-6">#{idx + 1}</span>
                      <span className="flex-1 font-medium text-slate-200">{item.states.name}</span>
                      <span className="font-mono text-indigo-300 font-semibold">{item.elo}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
