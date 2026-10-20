import { FORMATION_POSITIONS, SLOT_KEYS, type ScoreBreakdown } from './game-engine.ts';
import { SITE_HOST, SITE_NAME } from './site.ts';

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

/** Draws the shareable result card and hands it to the native share sheet (or downloads it). */
export async function shareResultCard(ranked: ScoreBreakdown[]) {
  const winner = ranked[0];
  if (!winner) return;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, '#1c1710');
  gradient.addColorStop(0.45, '#15110b');
  gradient.addColorStop(1, '#0c0a07');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.strokeStyle = 'rgba(255,180,92,.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_WIDTH; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_HEIGHT; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffb45c';
  ctx.font = '900 28px system-ui';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText('MEZAT TAMAMLANDI', 70, 90);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = '#f7efe2';
  ctx.font = '950 76px system-ui';
  ctx.fillText('Gecenin şampiyonu', 70, 185);
  ctx.fillStyle = '#ffb45c';
  ctx.font = '950 92px system-ui';
  ctx.fillText(winner.name.slice(0, 20), 70, 290, 940);
  ctx.fillStyle = '#f7efe2';
  ctx.font = '900 46px system-ui';
  ctx.fillText(`${winner.score.toFixed(2)} TAKIM PUANI`, 72, 365);

  ctx.fillStyle = 'rgba(255,180,92,.06)';
  ctx.fillRect(58, 415, 964, 300);
  ctx.fillStyle = '#b3a795';
  ctx.font = '800 24px system-ui';
  ctx.fillText('SONUÇ SIRALAMASI', 88, 465);
  ranked.slice(0, 5).forEach((team, index) => {
    const y = 525 + index * 47;
    ctx.fillStyle = index === 0 ? '#ffb45c' : '#f7efe2';
    ctx.font = index === 0 ? '900 30px system-ui' : '750 27px system-ui';
    ctx.fillText(`${index + 1}. ${team.name.slice(0, 23)}`, 88, y);
    ctx.textAlign = 'right';
    ctx.fillText(team.score.toFixed(2), 980, y);
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = '#ffb45c';
  ctx.fillRect(0, 760, CARD_WIDTH, 150);
  ctx.fillStyle = '#0c0a07';
  ctx.beginPath();
  ctx.arc(95, 835, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb45c';
  ctx.font = '950 64px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('M', 95, 858);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0c0a07';
  ctx.font = '950 42px system-ui';
  ctx.fillText(SITE_NAME.toLocaleUpperCase('tr'), 165, 825);
  ctx.font = '750 24px system-ui';
  ctx.fillText(SITE_HOST, 165, 865);

  ctx.fillStyle = '#f7efe2';
  ctx.font = '900 36px system-ui';
  ctx.fillText(`ŞAMPİYON İLK 11 · ${winner.formation || '4-2-3-1'}`, 70, 980);
  const pitch = { x: 70, y: 1030, w: 940, h: 770 };
  ctx.fillStyle = '#14100a';
  ctx.fillRect(pitch.x, pitch.y, pitch.w, pitch.h);
  ctx.strokeStyle = 'rgba(247,239,226,.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(pitch.x + 18, pitch.y + 18, pitch.w - 36, pitch.h - 36);
  ctx.beginPath();
  ctx.moveTo(pitch.x + 18, pitch.y + pitch.h / 2);
  ctx.lineTo(pitch.x + pitch.w - 18, pitch.y + pitch.h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pitch.x + pitch.w / 2, pitch.y + pitch.h / 2, 72, 0, Math.PI * 2);
  ctx.stroke();

  const formation = FORMATION_POSITIONS[winner.formation || '4-2-3-1'];
  SLOT_KEYS.forEach((slot) => {
    const player = winner.squad[slot],
      point = formation[slot],
      x = pitch.x + (Number.parseFloat(point.left) / 100) * pitch.w,
      y = pitch.y + (Number.parseFloat(point.top) / 100) * pitch.h,
      rawName = player?.name || slot,
      parts = rawName.trim().split(/\s+/),
      displayName = rawName.length > 14 && parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : rawName;
    ctx.fillStyle = '#ffb45c';
    ctx.beginPath();
    ctx.arc(x, y, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c0a07';
    ctx.font = '950 18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(player ? player.rating.toFixed(0) : slot, x, y + 6);
    ctx.fillStyle = '#f7efe2';
    ctx.font = '800 17px system-ui';
    ctx.fillText(displayName.slice(0, 16), x, y + 53, 152);
    ctx.fillStyle = '#ffb45c';
    ctx.font = '800 14px system-ui';
    ctx.fillText(slot, x, y + 72);
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = '#b3a795';
  ctx.font = '700 20px system-ui';
  ctx.fillText(
    `İlk 11 ${winner.starterImpact.toFixed(1)} · Yedek +${winner.benchDepth.toFixed(1)} · Teknik direktör +${winner.coachBoost.toFixed(1)}`,
    70,
    1860,
  );
  ctx.fillStyle = '#ffb45c';
  ctx.font = '900 24px system-ui';
  ctx.fillText(`Yeni oda kur: ${SITE_HOST}`, 70, 1902);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'mezat-11-sonucu.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${SITE_NAME} sonucu` });
    else {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  } catch (error) {
    if ((error as DOMException).name !== 'AbortError') throw error;
  }
}
