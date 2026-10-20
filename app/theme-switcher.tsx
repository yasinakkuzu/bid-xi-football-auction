'use client';

import { useEffect, useState } from 'react';

export type MezatTheme = 'vip' | 'champions' | 'stadium';

const THEMES: ReadonlyArray<{ id: MezatTheme; icon: string; label: string }> = [
  { id: 'vip', icon: '🏛️', label: 'VIP Salon' },
  { id: 'champions', icon: '🏟️', label: 'Şampiyonlar' },
  { id: 'stadium', icon: '🌿', label: 'Stadyum' },
];

function readSavedTheme(): MezatTheme {
  try {
    if (typeof localStorage === 'undefined') return 'vip';
    const saved = localStorage.getItem('mezat11-theme');
    if (saved === 'vip' || saved === 'champions' || saved === 'stadium') return saved;
  } catch {}
  return 'vip';
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<MezatTheme>('vip');

  useEffect(() => {
    const initial = readSavedTheme();
    const id = setTimeout(() => setTheme(initial), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('mezat11-theme', theme);
    } catch {}
  }, [theme]);

  return (
    <div className="mz-theme-switcher" role="group" aria-label="Tasarım atmosferi">
      {THEMES.map((item) => (
        <button
          key={item.id}
          type="button"
          className={theme === item.id ? 'active' : ''}
          aria-pressed={theme === item.id}
          onClick={() => setTheme(item.id)}
          title={`${item.label} atmosferi`}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
