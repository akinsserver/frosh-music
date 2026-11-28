import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '15', 10);

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ songs: [] });
    }

    const { data, error } = await supabase.rpc('get_community_trending_songs', {
      p_limit: limit,
    });

    if (error || !Array.isArray(data)) {
      return NextResponse.json({ songs: [] });
    }

    return NextResponse.json({ songs: data });
  } catch {
    return NextResponse.json({ songs: [] });
  }
}
