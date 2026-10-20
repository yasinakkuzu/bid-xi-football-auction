export interface ParsedMezatDeepLink {
  mode: 'online' | 'solo' | 'home';
  roomCode?: string;
}

/**
 * Parses Universal Links (`https://mezat11.com/?mode=online&room=ABC123`, `https://mezat11.com/online?room=ABC123`)
 * and Custom Scheme Links (`mezat11://room/ABC123`) into structured navigation intents.
 */
export function parseMezatDeepLink(rawUrl: string | null | undefined): ParsedMezatDeepLink {
  if (!rawUrl || typeof rawUrl !== 'string') return { mode: 'home' };
  const trimmed = rawUrl.trim();
  if (!trimmed) return { mode: 'home' };

  const customSchemeMatch = trimmed.match(/^mezat11:\/\/room\/([A-Za-z0-9]{4,8})/i);
  if (customSchemeMatch) {
    return {
      mode: 'online',
      roomCode: customSchemeMatch[1].toUpperCase(),
    };
  }

  try {
    const normalized = trimmed.startsWith('mezat11://')
      ? trimmed.replace(/^mezat11:\/\//i, 'https://mezat11.com/')
      : trimmed;
    const url = new URL(normalized);
    const roomParam = url.searchParams.get('room')?.trim();
    if (roomParam && /^[A-Za-z0-9]{4,8}$/.test(roomParam)) {
      return {
        mode: 'online',
        roomCode: roomParam.toUpperCase(),
      };
    }
    const pathMatch = url.pathname.match(/\/room\/([A-Za-z0-9]{4,8})/i);
    if (pathMatch) {
      return {
        mode: 'online',
        roomCode: pathMatch[1].toUpperCase(),
      };
    }
    if (url.searchParams.get('mode') === 'solo') return { mode: 'solo' };
    if (url.searchParams.get('mode') === 'online' || url.pathname.startsWith('/online')) {
      return { mode: 'online' };
    }
  } catch {
    return { mode: 'home' };
  }

  return { mode: 'home' };
}

export async function triggerBidHaptic(bidAmount: number): Promise<void> {
  try {
    const Haptics = await import('expo-haptics');
    const style =
      bidAmount >= 120
        ? Haptics.ImpactFeedbackStyle.Heavy
        : bidAmount >= 60
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light;
    await Haptics.impactAsync(style);
  } catch {
    try {
      const { Vibration } = await import('react-native');
      Vibration.vibrate(25);
    } catch {}
  }
}

export async function triggerSoldHaptic(): Promise<void> {
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    try {
      const { Vibration } = await import('react-native');
      Vibration.vibrate([30, 50, 80]);
    } catch {}
  }
}

export async function triggerTimerWarningHaptic(): Promise<void> {
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

export async function shareRoomInviteNative(roomCode: string, baseUrl = 'https://mezat11.com'): Promise<void> {
  const cleanCode = roomCode.trim().toUpperCase();
  const url = `${baseUrl}/?mode=online&room=${cleanCode}&utm_source=mobile_app&utm_medium=invite`;
  const message = `Mezat 11'de odam açık — 6 haneli kod: ${cleanCode}. Katılmak için dokun: ${url}`;
  const { Share } = await import('react-native');
  await Share.share({
    title: 'Mezat 11 odasına katıl',
    message,
    url,
  });
}
