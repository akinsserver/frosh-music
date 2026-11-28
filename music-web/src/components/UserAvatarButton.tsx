'use client';

import React, { useEffect, useState } from 'react';
import { SettingsModal } from '@/components/SettingsModal';
import { getAvatarById } from '@/lib/avatars';
import { fetchSessionOnce, invalidateSessionCache } from '@/lib/clientCache';

export function UserAvatarButton() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; avatarId: string }>({
    name: '',
    avatarId: 'neon-beats',
  });

  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const cached = localStorage.getItem('vyla_user_profile');
        if (cached) {
          const parsed = JSON.parse(cached);
          setUserProfile({
            name: parsed.display_name || '',
            avatarId: parsed.avatar_id || 'neon-beats',
          });
        }
      } catch {}
    };

    loadFromStorage();

    fetchSessionOnce()
      .then((data) => {
        const user = data?.user;
        if (user) {
          const metaName = user.user_metadata?.display_name || user.user_metadata?.full_name || '';
          const metaAvatar = user.user_metadata?.avatar_id || 'neon-beats';
          setUserProfile({ name: metaName, avatarId: metaAvatar });
        }
      })
      .catch(() => {});

    window.addEventListener('vyla-profile-updated', loadFromStorage);
    return () => window.removeEventListener('vyla-profile-updated', loadFromStorage);
  }, []);

  const userAvatar = getAvatarById(userProfile.avatarId);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        data-focusable="true"
        className="relative flex items-center justify-center p-0.5 rounded-2xl ring-2 ring-emerald-500/40 hover:ring-emerald-400 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer shrink-0"
        title={userProfile.name ? `${userProfile.name} (Settings)` : 'Settings & Profile'}
        aria-label="Settings and Profile"
      >
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${userAvatar.gradient} flex items-center justify-center text-lg sm:text-xl shadow-inner border border-white/20 overflow-hidden`}
        >
          {userAvatar.imageUrl ? (
            <img src={userAvatar.imageUrl} alt={userAvatar.name} className="w-full h-full object-cover" />
          ) : (
            userAvatar.emoji
          )}
        </div>
      </button>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onProfileUpdated={(updated) => {
          invalidateSessionCache();
          setUserProfile(updated);
          window.dispatchEvent(new Event('vyla-profile-updated'));
        }}
      />
    </>
  );
}
