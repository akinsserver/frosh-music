import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server authentication is not configured.' },
        { status: 500 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, avatarId, avatarUrl } = body || {};

    const updateData: Record<string, any> = {};
    if (name) {
      updateData.display_name = String(name).trim();
      updateData.full_name = String(name).trim();
    }
    if (avatarId) updateData.avatar_id = avatarId;
    if (avatarUrl) updateData.avatar_url = avatarUrl;

    // 1. Update Supabase Auth user metadata
    const { data: updatedAuth, error: authErr } = await supabase.auth.updateUser({
      data: updateData,
    });

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    // 2. Best-effort update profiles table
    if (name || avatarUrl) {
      try {
        await supabase.from('profiles').update({
          display_name: name ? String(name).trim() : undefined,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);
      } catch {
        // Non-blocking if profiles table has not been created yet
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedAuth.user?.id,
        email: updatedAuth.user?.email,
        name: updatedAuth.user?.user_metadata?.display_name || String(name).trim(),
        avatarId: updatedAuth.user?.user_metadata?.avatar_id || avatarId,
        avatarUrl: updatedAuth.user?.user_metadata?.avatar_url || avatarUrl,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
