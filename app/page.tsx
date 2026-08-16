'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type State = {
  id: string;
  name: string;
  image_url: string;
  elo: number;
};

export default function Home() {
  const [states, setStates] = useState<State[]>([]);
  const [pair, setPair] = useState<[State, State] | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch all states on load
  useEffect(() => {
    async function loadStates() {
      const { data } = await supabase.from('states').select('*');
      if (data) {
        setStates(data);
        selectRandomPair(data);
      }
      setLoading(false);
    }
    loadStates();
  }, []);

  // Pick two distinct random states
  function selectRandomPair(allStates: State[]) {
    if (allStates.length < 2) return;
    const firstIndex = Math.floor(Math.random() * allStates.length);
    let secondIndex = Math.floor(Math.random() * allStates.length);
    
    while (secondIndex === firstIndex) {
      secondIndex = Math.floor(Math.random() * allStates.length);
    }

    setPair([allStates[firstIndex], allStates[secondIndex]]);
  }

  // Cast a vote
  async function handleVote(winner: State, loser: State) {
    // Instantly pick a new pair so UI feels fast
    selectRandomPair(states);

    // Send vote to API route
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerId: winner.id, loserId: loser.id }),
    });
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-xl font-bold bg-slate-900 text-white">Loading state maps...</div>;
  }

  if (!pair) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-900 text-white">
      <h1 className="text-3xl font-extrabold mb-2 text-center">Which State Has Better County Borders?</h1>
      <p className="text-slate-400 mb-8 text-center">Click a map to vote for your favorite</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {pair.map((state, idx) => {
          const opponent = pair[idx === 0 ? 1 : 0];
          return (
            <button
              key={state.id}
              onClick={() => handleVote(state, opponent)}
              className="flex flex-col items-center bg-slate-800 border-2 border-slate-700 hover:border-indigo-500 rounded-xl p-6 transition transform hover:-translate-y-1 hover:shadow-xl cursor-pointer"
            >
              <div className="relative w-full h-64 mb-4 flex items-center justify-center bg-slate-950 rounded-lg p-2">
                {/* eslint-disable-next-next/no-img-element */}
                <img
                  src={state.image_url}
                  alt={state.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <span className="text-2xl font-bold">{state.name}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
