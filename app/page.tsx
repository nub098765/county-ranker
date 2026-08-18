'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import PersonalRankingsDrawer from './components/PersonalRankingsDrawer';

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
};

type StandingsItem = {
  id: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
};

export default function Home() {
  const [pair, setPair] = useState<[State, State] | null>(null);
  const [nextPair, setNextPair] = useState<[State, State] | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullStandings, setFullStandings] = useState<StandingsItem[]>([]);

  const activeUserIdRef = useRef<string | null>(null);

  const fetchUserStats = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_stats')
      .select('total_votes')
      .eq('user_id', userId)
      .single();

    if (data) {
      setStats(data);
    } else {
      setStats({ total_votes: 0 });
    }
  }, []);

  const fetchFullStandings = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_state_ratings')
      .select('elo, wins, losses, state_id, states(id, name)')
      .eq('user_id', userId)
      .order('elo', { ascending: false });

    if (data) {
      const mapped = data.map((row: any) => {
        const stateObj = Array.isArray(row.states) ? row.states[0] : row.states;
        return {
          id: stateObj?.id ?? row.state_id,
          name: stateObj?.name ?? 'Unknown State',
          elo: Number(row.elo ?? 1000),
          wins: row.wins ?? 0,
          losses: row.losses ?? 0,
        };
      });
      setFullStandings(mapped);
    }
  }, []);

  const getSingleUnvotedPair = useCallback(async (userId: string): Promise<[State, State] | null> => {
    const { data, error } = await supabase.rpc('get_unvoted_pair', {
      current_user_id: userId,
    });

    if (error || !data || data.length === 0) return null;

    const row = data[0];
    return [
      { id: row.state1_id, name: row.state1_name, image_url: row.state1_image_url, elo: row.state1_elo },
      { id: row.state2_id, name: row.state2_name, image_url: row.state2_image_url, elo: row.state2_elo },
    ];
  }, []);

  const initPairs = useCallback(async (userId: string) => {
    const first = await getSingleUnvotedPair(userId);
    if (!first) {
      setCompleted(true);
      setPair(null);
      await fetchFullStandings(userId);
      return;
    }
    setPair(first);

    const second = await getSingleUnvotedPair(userId);
    if (second) {
      setNextPair(second);
    }
  }, [getSingleUnvotedPair, fetchFullStandings]);

  useEffect(() => {
    let mounted = true;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      const currentUserId = currentUser?.id ?? null;

      if (!mounted) return;

      setUser(currentUser);

      if (currentUserId !== activeUserIdRef.current) {
        activeUserIdRef.current = currentUserId;

        if (currentUserId) {
          await fetchUserStats(currentUserId);
          await initPairs(currentUserId);
        } else {
          setStats(null);
          setPair(null);
          setNextPair(null);
          setCompleted(false);
          setFullStandings([]);
        }
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserStats, initPairs]);

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
    activeUserIdRef.current = null;
    setUser(null);
    setStats(null);
    setPair(null);
    setNextPair(null);
    setCompleted(false);
    setFullStandings([]);
  }

  async function handleVote(winner: State, loser: State) {
    if (!user || !pair || isSubmitting) return;

    setIsSubmitting(true);

    setStats((prev) => ({
      total_votes: (prev?.total_votes || 0) + 1,
    }));

    if (nextPair) {
      setPair(nextPair);
      setNextPair(null);
    } else {
      setPair(null);
    }

    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          winnerId: winner.id, 
          loserId: loser.id,
          userId: user.id 
        }),
      });

      const upcomingPair = await getSingleUnvotedPair(user.id);
      if (upcomingPair) {
        setNextPair(upcomingPair);
        setPair((curr) => curr ?? upcomingPair);
      } else if (!nextPair) {
        setCompleted(true);
        await fetchFullStandings(user.id);
      }

      await fetchUserStats(user.id);
    } catch (err) {
      console.error('Vote submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl font-bold bg-slate-900 text-white">
        Loading state maps...
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-slate-900 text-white overflow-x-hidden">
      {user && <PersonalRankingsDrawer />}

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
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 bg-slate-800 border border-slate-700 px-6 py-3 rounded-xl shadow-md">
            <p className="text-slate-300">
              Logged in as <span className="text-indigo-400 font-semibold">{user.user_metadata?.full_name || user.email}</span>
            </p>

            <div className="flex items-center gap-4 text-sm border-t sm:border-t-0 sm:border-l border-slate-700 pt-2 sm:pt-0 sm:pl-4">
              <div>
                <span className="text-slate-400">Total Votes: </span>
                <span className="font-bold text-indigo-300">{stats?.total_votes ?? 0} / 1225</span>
              </div>
            </div>

            <button
              onClick={logout}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold py-1 px-3 rounded transition cursor-pointer sm:ml-auto"
            >
              Sign Out
            </button>
          </div>

          {completed && !pair ? (
            <div className="flex flex-col items-center justify-center bg-slate-800 border-2 border-indigo-500 rounded-2xl p-6 sm:p-8 w-full max-w-2xl text-center shadow-2xl my-8">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-indigo-400 mb-2">You did it!</h2>
              <p className="text-slate-300 text-base sm:text-lg mb-6">
                You evaluated all <span className="font-bold text-white">1,225 unique state matchups</span>. Your votes have been recorded. Here's how the states stacked up in your personal rankings:
              </p>

              <div className="w-full bg-slate-950 border border-slate-700 rounded-xl overflow-hidden text-left max-h-96 overflow-y-auto divide-y divide-slate-800">
                {fullStandings.map((item, idx) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-sm hover:bg-slate-900 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400 font-semibold w-8">#{idx + 1}</span>
                      <span className="font-medium text-slate-100">{item.name}</span>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <span className="text-slate-400 text-xs">{item.wins}W - {item.losses}L</span>
                      <span className="font-mono font-bold text-indigo-300 text-base">{item.elo}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            pair && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                {pair.map((state, idx) => {
                  const opponent = pair[idx === 0 ? 1 : 0];
                  return (
                    <button
                      key={state.id}
                      disabled={isSubmitting}
                      onClick={() => handleVote(state, opponent)}
                      className="flex flex-col items-center bg-slate-100 hover:bg-white disabled:opacity-50 text-slate-900 border-2 border-slate-300 hover:border-indigo-500 rounded-xl p-6 transition transform hover:-translate-y-1 hover:shadow-xl cursor-pointer"
                    >
                      <div className="relative w-full h-64 mb-4 flex items-center justify-center p-2">
                        {/* eslint-disable-next-next/no-img-element */}
                        <img
                          src={state.image_url}
                          alt={state.name}
                          loading="eager"
                          decoding="async"
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
