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
  const [pair, setPair] = useState<[State, State] | null>(null);
  const [nextPair, setNextPair] = useState<[State, State] | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
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

  // Fetch a single unvoted pair from Supabase
  async function getSingleUnvotedPair(userId: string): Promise<[State, State] | null> {
    const { data, error } = await supabase.rpc('get_unvoted_pair', {
      current_user_id: userId,
    });

    if (error || !data || data.length === 0) return null;

    const row = data[0];
    return [
      { id: row.state1_id, name: row.state1_name, image_url: row.state1_image_url, elo: row.state1_elo },
      { id: row.state2_id, name: row.state2_name, image_url: row.state2_image_url, elo: row.state2_elo },
    ];
  }

  // Load current pair AND pre-fetch next pair
  async function initPairs(userId: string) {
    const first = await getSingleUnvotedPair(userId);
    if (!first) {
      setCompleted(true);
      setPair(null);
      return;
    }
    setPair(first);

    // Pre-fetch second pair in background
    const second = await getSingleUnvotedPair(userId);
    if (second) {
      setNextPair(second);
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchUserStats(currentUser.id);
        await initPairs(currentUser.id);
      }
      setLoading(false);
    }
    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchUserStats(currentUser.id);
        await initPairs(currentUser.id);
      } else {
        setStats(null);
        setPair(null);
        setNextPair(null);
        setCompleted(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loginWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}`,
        scopes: 'identify',
      },
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setStats(null);
    setPair(null);
    setNextPair(null);
    setCompleted(false);
  }

  async function handleVote(winner: State, loser: State) {
    if (!user || !pair) return;

    // 1. INSTANT UI UPDATE (0ms delay)
    setStats((prev) => ({
      total_votes: (prev?.total_votes || 0) + 1,
      fav_state_name: prev?.fav_state_name || winner.name,
    }));

    // Swap to prefetched pair immediately
    if (nextPair) {
      setPair(nextPair);
      setNextPair(null);
    } else {
      setPair(null);
    }

    // 2. BACKGROUND WORK (Does not block UI)
    (async () => {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          winnerId: winner.id, 
          loserId: loser.id,
          userId: user.id 
        }),
      });

      // Pre-fetch the upcoming pair into nextPair
      const upcomingPair = await getSingleUnvotedPair(user.id);
      if (upcomingPair) {
        setNextPair(upcomingPair);
        setPair((curr) => curr ?? upcomingPair);
      } else if (!nextPair) {
        setCompleted(true);
      }

      fetchUserStats(user.id);
    })();
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
                <span className="font-bold text-indigo-300">{stats?.total_votes ?? 0} / 1225</span>
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

          {/* Completion Screen */}
          {completed && !pair ? (
            <div className="flex flex-col items-center justify-center bg-slate-800 border-2 border-indigo-500 rounded-2xl p-10 max-w-lg text-center shadow-2xl my-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-4xl font-extrabold text-indigo-400 mb-2">You did it!</h2>
              <p className="text-slate-300 text-lg">
                You evaluated all <span className="font-bold text-white">1,225 unique state matchups</span>.
              </p>
              <p className="text-slate-400 text-sm mt-4">
                Your top favorite state: <span className="text-amber-400 font-semibold">{stats?.fav_state_name ?? 'N/A'}</span>
              </p>
            </div>
          ) : (
            pair && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                {pair.map((state, idx) => {
                  const opponent = pair[idx === 0 ? 1 : 0];
                  return (
                    <button
                      key={state.id}
                      onClick={() => handleVote(state, opponent)}
                      className="flex flex-col items-center bg-slate-100 hover:bg-white text-slate-900 border-2 border-slate-300 hover:border-indigo-500 rounded-xl p-6 transition transform hover:-translate-y-1 hover:shadow-xl cursor-pointer"
                    >
                      <div className="relative w-full h-64 mb-4 flex items-center justify-center p-2">
                        {/* eslint-disable-next-next/no-img-element */}
                        <img
                          src={state.image_url}
                          alt={state.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <span className="text-2xl font-bold text-slate-900">{state.name}</span>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </>
      )}
    </main>
  );
}
