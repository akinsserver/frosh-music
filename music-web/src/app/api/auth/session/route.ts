import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.display_name || user.user_metadata?.full_name || '',
        avatarId: user.user_metadata?.avatar_id || 'neon-beats',
        avatarUrl: user.user_metadata?.avatar_url || '',
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
