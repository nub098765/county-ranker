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

type UserStats = {
  total_votes: number;
  fav_state_name: string | null;
};

export default function Home() {
  const [states, setStates] = useState<State[]>([]);
  const [pair, setPair] = useState<[State, State] | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  // Fetch stats for the logged-in user
  async function fetchUserStats(userId: string) {
    const { data } = await supabase
      .from('user_stats')
      .select('total_votes, fav_state_name')
      .eq('user_id', userId)
      .single();

    if (data) {
      setStats(data);
    } else {
      setStats({ total_votes: 0, fav_state_name: null });
    }
  }

  // Fetch states and check current user session on load
  useEffect(() => {
    async function init() {
      // 1. Get logged-in user
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        fetchUserStats(currentUser.id);
      }

      // 2. Fetch states
      const { data } = await supabase.from('states').select('*');
      if (data) {
        setStates(data);
        selectRandomPair(data);
      }
      setLoading(false);
    }
    init();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserStats(currentUser.id);
      } else {
        setStats(null);
      }
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
      options: {
        redirectTo: `${window.location.origin}`,
        scopes: 'identify',
      },
    });
  }

  // Logout Helper
  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setStats(null);
  }

  // Cast a vote
  async function handleVote(winner: State, loser: State) {
    if (!user) return; // Prevent voting if not logged in

    // Instantly pick a new pair so UI feels fast
    selectRandomPair(states);

    // Optimistically bump vote count in local state
    setStats((prev) => ({
      total_votes: (prev?.total_votes || 0) + 1,
      fav_state_name: prev?.fav_state_name || winner.name,
    }));

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

    // Refresh accurate stats from database
    fetchUserStats(user.id);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl font-bold bg-slate-900 text-white">
        Loading state maps...
      </div>
    );
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
          {/* User Bar with Stats */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 bg-slate-800 border border-slate-700 px-6 py-3 rounded-xl shadow-md">
            <p className="text-slate-300">
              Logged in as <span className="text-indigo-400 font-semibold">{user.user_metadata?.full_name || user.email}</span>
            </p>

            <div className="flex items-center gap-4 text-sm border-t sm:border-t-0 sm:border-l border-slate-700 pt-2 sm:pt-0 sm:pl-4">
              <div>
                <span className="text-slate-400">Total Votes: </span>
                <span className="font-bold text-indigo-300">{stats?.total_votes ?? 0}</span>
              </div>
              {stats?.fav_state_name && (
                <div>
                  <span className="text-slate-400">Favorite State: </span>
                  <span className="font-bold text-amber-400">{stats.fav_state_name}</span>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold py-1 px-3 rounded transition cursor-pointer sm:ml-auto"
            >
              Sign Out
            </button>
          </div>

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
                    {/* Outer Frame with Light Inner Backdrop for Transparent PNGs */}
                    <div className="relative w-full h-64 mb-4 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-lg p-2">
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-md p-3">
                        {/* eslint-disable-next-next/no-img-element */}
                        <img
                          src={state.image_url}
                          alt={state.name}
                          className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                        />
                      </div>
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
