import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, email, password, name, avatarId, avatarUrl } = body || {};

    if (!code || !email || !password || !name) {
      return NextResponse.json(
        { error: 'Code, email, password, and name are required.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Authentication service is not configured on the server.' },
        { status: 500 }
      );
    }

    const trimmedCode = String(code).trim();
    const trimmedEmail = String(email).trim();
    const trimmedName = String(name).trim();

    // 1. Verify access code before allowing registration
    const { data: codeValid } = await supabase.rpc('validate_access_code', {
      p_code: trimmedCode,
    });
    let isAuthorized = codeValid === true;

    if (!isAuthorized) {
      const { data: inviteValid } = await supabase.rpc('validate_invite_code', {
        p_code: trimmedCode,
      });
      isAuthorized = inviteValid === true;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Invalid or expired access code.' },
        { status: 403 }
      );
    }

    // 2. Register user in Supabase Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: String(password),
      options: {
        data: {
          display_name: trimmedName,
          full_name: trimmedName,
          avatar_id: avatarId || 'neon-beats',
          avatar_url: avatarUrl || '',
          access_code: trimmedCode,
        },
      },
    });

    if (signUpError) {
      return NextResponse.json(
        { error: signUpError.message },
        { status: 400 }
      );
    }

    const user = authData.user;
    if (user?.id) {
      // 3. Upsert profile row (best-effort)
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: trimmedEmail,
          display_name: trimmedName,
          avatar_url: avatarUrl || '',
          access_code_used: trimmedCode,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Non-blocking
      }

      // 4. Record access code usage
      try {
        const { error: rpcErr } = await supabase.rpc('record_access_code_use', { p_code: trimmedCode });
        if (rpcErr) {
          await supabase.rpc('record_invite_code_use', { p_code: trimmedCode });
        }
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user?.id,
        email: user?.email,
        name: trimmedName,
        avatarId: avatarId || 'neon-beats',
        avatarUrl: avatarUrl || '',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error creating account.' },
      { status: 500 }
    );
  }
}
