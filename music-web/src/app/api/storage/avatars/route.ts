import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ avatars: [] });
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
    const candidateBuckets = ['avatars', 'avatar', 'images', 'profile-pictures', 'profiles'];
    const avatars: any[] = [];

    for (const bucket of candidateBuckets) {
      try {
        const { data, error } = await supabase.storage.from(bucket).list('', {
          limit: 50,
          sortBy: { column: 'name', order: 'asc' },
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          for (const file of data) {
            if (!/\.(png|jpe?g|webp|svg|gif|avif)$/i.test(file.name)) continue;

            const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeURIComponent(file.name)}`;
            const friendlyName = file.name
              .replace(/\.[^/.]+$/, '')
              .replace(/[-_]/g, ' ')
              .replace(/\b\w/g, (l: string) => l.toUpperCase());

            avatars.push({
              id: publicUrl,
              name: friendlyName,
              emoji: '🖼️',
              imageUrl: publicUrl,
              gradient: 'from-emerald-400 via-teal-500 to-emerald-700',
              border: 'border-emerald-400',
              bgHex: '#10b981',
            });
          }
          if (avatars.length > 0) break;
        }
      } catch {}
    }

    return NextResponse.json({ avatars });
  } catch {
    return NextResponse.json({ avatars: [] });
  }
}
