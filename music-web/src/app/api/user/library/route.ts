import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ likedSongs: [], playlists: [], history: [] });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ likedSongs: [], playlists: [], history: [] });
    }

    const { data, error } = await supabase
      .from('user_libraries')
      .select('liked_songs, playlists, history')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ likedSongs: [], playlists: [], history: [] });
    }

    return NextResponse.json({
      likedSongs: data.liked_songs || [],
      playlists: data.playlists || [],
      history: data.history || [],
    });
  } catch {
    return NextResponse.json({ likedSongs: [], playlists: [], history: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service not available' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { likedSongs, playlists, history } = body || {};

    const { error } = await supabase.from('user_libraries').upsert({
      user_id: user.id,
      liked_songs: Array.isArray(likedSongs) ? likedSongs : [],
      playlists: Array.isArray(playlists) ? playlists : [],
      history: Array.isArray(history) ? history : [],
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
