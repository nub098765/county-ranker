import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Calculate new Elo rating
function getNewElos(winnerElo: number, loserElo: number) {
  const K = 32;
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

  const newWinnerElo = Math.round(winnerElo + K * (1 - expectedWinner));
  const newLoserElo = Math.round(loserElo + K * (0 - expectedLoser));

  return { newWinnerElo, newLoserElo };
}

export async function POST(req: Request) {
  try {
    const { winnerId, loserId, userId } = await req.json();

    if (!winnerId || !loserId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch current ratings for winner and loser
    const { data: winner } = await supabase.from('states').select('elo, wins').eq('id', winnerId).single();
    const { data: loser } = await supabase.from('states').select('elo, losses').eq('id', loserId).single();

    if (!winner || !loser) {
      return NextResponse.json({ error: 'State not found' }, { status: 404 });
    }

    // 2. Calculate updated Elo ratings
    const { newWinnerElo, newLoserElo } = getNewElos(winner.elo, loser.elo);

    // 3. Update winner state
    await supabase
      .from('states')
      .update({ elo: newWinnerElo, wins: (winner.wins || 0) + 1 })
      .eq('id', winnerId);

    // 4. Update loser state
    await supabase
      .from('states')
      .update({ elo: newLoserElo, losses: (loser.losses || 0) + 1 })
      .eq('id', loserId);

    // 5. Log the vote history entry
    await supabase.from('votes').insert({
      user_id: userId,
      winner_id: winnerId,
      loser_id: loserId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to process vote' }, { status: 500 });
  }
}
