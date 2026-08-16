import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { winnerId, loserId } = await req.json();

    // 1. Fetch current ratings
    const { data: winner } = await supabase.from('states').select('elo, wins').eq('id', winnerId).single();
    const { data: loser } = await supabase.from('states').select('elo, losses').eq('id', loserId).single();

    if (!winner || !loser) {
      return NextResponse.json({ error: 'State not found' }, { status: 404 });
    }

    // 2. Calculate updated Elo ratings
    const K = 32;
    const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winner.elo - loser.elo) / 400));

    const newWinnerElo = Math.round(winner.elo + K * (1 - expectedWinner));
    const newLoserElo = Math.round(loser.elo + K * (0 - expectedLoser));

    // 3. Update database
    await supabase.from('states').update({ elo: newWinnerElo, wins: winner.wins + 1 }).eq('id', winnerId);
    await supabase.from('states').update({ elo: newLoserElo, losses: loser.losses + 1 }).eq('id', loserId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
  }
}
