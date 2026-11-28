import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body || {};

    if (!code || !String(code).trim()) {
      return NextResponse.json(
        { error: 'Access code is required.' },
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

    // 1. Try validate_access_code RPC
    const { data: accessValid, error: accessErr } = await supabase.rpc('validate_access_code', {
      p_code: trimmedCode,
    });

    if (!accessErr && accessValid === true) {
      return NextResponse.json({ valid: true });
    }

    // 2. Backward compatibility fallback: validate_invite_code RPC
    const { data: inviteValid } = await supabase.rpc('validate_invite_code', {
      p_code: trimmedCode,
    });

    if (inviteValid === true) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({
      valid: false,
      error: 'Invalid or inactive access code. Check spelling or request a new code.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error verifying code.' },
      { status: 500 }
    );
  }
}
