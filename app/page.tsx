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
  const [user, setUser] = useState<any>(null);

  // Fetch states and check current user session on load
  useEffect(() => {
    async function init() {
      // 1. Get logged-in user
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      // 2. Fetch states
      const { data } = await supabase.from('states').select('*');
      if (data) {
        setStates(data);
        selectRandomPair(data);
      }
      setLoading(false);
    }
    init();

    // Listen for auth state changes (e.g., when returning from Discord login)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
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

  // Discord Login Helper
  async function loginWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      redirectTo: `${window.location.origin}`,
    });
  }

  // Cast a vote
  async function handleVote(winner: State, loser: State) {
    if (!user) return; // Prevent voting if not logged in

    // Instantly pick a new pair so UI feels fast
    selectRandomPair(states);

    // Send vote and user info to API route
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        winnerId: winner.id, 
        loserId: loser.id,
        userId: user.id 
      }),
    });
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-xl font-bold bg-slate-900 text-white">Loading state maps...</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-900 text-white">
      <h1 className="text-3xl font-extrabold mb-2 text-center">Which State Has Better County Borders?</h1>
      
      {/* Show Discord user info or Login button */}
      {!user ? (
        <div className="flex flex-col items-center gap-4 my-8">
          <p className="text-slate-400 text-center">Please sign in with Discord to vote!</p>
          <button
            onClick={loginWithDiscord}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 px-6 rounded-lg transition shadow-lg cursor-pointer flex items-center gap-2"
          >
            Sign in with Discord
          </button>
        </div>
      ) : (
        <>
          <p className="text-slate-400 mb-8 text-center">
            Logged in as <span className="text-indigo-400 font-semibold">{user.user_metadata?.full_name || user.email}</span>
          </p>

          {pair && (
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
          )}
        </>
      )}
    </main>
  );
}
