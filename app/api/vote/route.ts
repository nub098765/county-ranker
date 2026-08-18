import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { winnerId, loserId, userId } = await request.json();

    if (!winnerId || !loserId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Insert vote (Triggers handle personal ratings automatically)
    await supabase.from('votes').insert([
      { winner_id: winnerId, loser_id: loserId, user_id: userId }
    ]);

    // 2. Fetch user vote count and state data in parallel
    const [
      { count: userVoteCount },
      { data: states }
    ] = await Promise.all([
      supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('states')
        .select('id, elo, wins, losses')
        .in('id', [winnerId, loserId])
    ]);

    if (!states || states.length < 2) {
      return NextResponse.json({ error: 'State not found' }, { status: 404 });
    }

    const winner = states.find((s) => s.id === winnerId)!;
    const loser = states.find((s) => s.id === loserId)!;

    // 3. Calculate dynamic K-factor for global states using logarithmic attenuation
    const totalVotes = userVoteCount || 1;
    const BASE_K = 32;
    const DECAY_ALPHA = 0.15;
    const userK = BASE_K / (1 + DECAY_ALPHA * Math.log(1 + totalVotes));

    // 4. Expected scores and new global Elo ratings
    const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
    const expectedLoser = 1 - expectedWinner;

    const newWinnerElo = Number(winner.elo + userK * (1 - expectedWinner));
    const newLoserElo = Number(loser.elo + userK * (0 - expectedLoser));

    // 5. Update global states in parallel
    await Promise.all([
      supabase.from('states').update({ elo: newWinnerElo, wins: winner.wins + 1 }).eq('id', winnerId),
      supabase.from('states').update({ elo: newLoserElo, losses: loser.losses + 1 }).eq('id', loserId)
    ]);

    return NextResponse.json({ success: true, userKUsed: userK });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
