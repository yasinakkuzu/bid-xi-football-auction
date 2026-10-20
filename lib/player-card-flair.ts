import {
  FORMATION_POSITIONS,
  isCoach,
  ratingLevel,
  scoreManager,
  type AuctionLot,
  type Coach,
  type Footballer,
  type Manager,
  type ScoreBreakdown,
  type SimulatedMatch,
  type Slot,
  type TournamentRow,
} from './game-engine.ts';

export type CardRarityClass =
  'rarity-legend' | 'rarity-superstar' | 'rarity-elite' | 'rarity-great' | 'rarity-standard' | 'rarity-mystery';

export type ScoutHint = {
  badge: string;
  detail: string;
};

export type TransferStamp = {
  code: 'bargain' | 'record' | 'snipe' | 'fair';
  label: string;
  icon: string;
};

export type ChemistryLink = {
  from: Slot;
  to: Slot;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strength: 'strong' | 'medium';
  reason: string;
};

export type PitchChemistryReport = {
  links: ChemistryLink[];
  score: number;
  label: string;
};

export type NightAward = {
  id: string;
  icon: string;
  title: string;
  winnerName: string;
  stat: string;
  description: string;
};

export const QUICK_REACTIONS = [
  { id: 'steal', emoji: '🔥', label: 'Soygun!' },
  { id: 'overpaid', emoji: '💸', label: 'Çok Pahalı!' },
  { id: 'wall', emoji: '🧱', label: 'Duvar!' },
  { id: 'bluff', emoji: '👀', label: 'Blöf mü?' },
  { id: 'respect', emoji: '👏', label: 'Helal!' },
] as const;

const NATION_FLAGS: Record<string, string> = {
  turkey: '🇹🇷',
  türkiye: '🇹🇷',
  tur: '🇹🇷',
  tr: '🇹🇷',
  england: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  eng: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  sco: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  wal: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'northern ireland': '🇬🇧',
  nir: '🇬🇧',
  spain: '🇪🇸',
  esp: '🇪🇸',
  es: '🇪🇸',
  france: '🇫🇷',
  fra: '🇫🇷',
  fr: '🇫🇷',
  germany: '🇩🇪',
  ger: '🇩🇪',
  de: '🇩🇪',
  italy: '🇮🇹',
  ita: '🇮🇹',
  it: '🇮🇹',
  portugal: '🇵🇹',
  por: '🇵🇹',
  pt: '🇵🇹',
  brazil: '🇧🇷',
  bra: '🇧🇷',
  br: '🇧🇷',
  argentina: '🇦🇷',
  arg: '🇦🇷',
  ar: '🇦🇷',
  netherlands: '🇳🇱',
  ned: '🇳🇱',
  nl: '🇳🇱',
  belgium: '🇧🇪',
  bel: '🇧🇪',
  be: '🇧🇪',
  croatia: '🇭🇷',
  cro: '🇭🇷',
  hr: '🇭🇷',
  uruguay: '🇺🇾',
  uru: '🇺🇾',
  uy: '🇺🇾',
  colombia: '🇨🇴',
  col: '🇨🇴',
  morocco: '🇲🇦',
  mar: '🇲🇦',
  senegal: '🇸🇳',
  sen: '🇸🇳',
  nigeria: '🇳🇬',
  nga: '🇳🇬',
  egypt: '🇪🇬',
  egy: '🇪🇬',
  eg: '🇪🇬',
  ghana: '🇬🇭',
  gha: '🇬🇭',
  "cote d'ivoire": '🇨🇮',
  'ivory coast': '🇨🇮',
  cameroon: '🇨🇲',
  cmr: '🇨🇲',
  algeria: '🇩🇿',
  alg: '🇩🇿',
  tunisia: '🇹🇳',
  mali: '🇲🇱',
  guinea: '🇬🇳',
  poland: '🇵🇱',
  pol: '🇵🇱',
  pl: '🇵🇱',
  norway: '🇳🇴',
  nor: '🇳🇴',
  no: '🇳🇴',
  sweden: '🇸🇪',
  swe: '🇸🇪',
  se: '🇸🇪',
  denmark: '🇩🇰',
  den: '🇩🇰',
  dk: '🇩🇰',
  switzerland: '🇨🇭',
  sui: '🇨🇭',
  ch: '🇨🇭',
  austria: '🇦🇹',
  aut: '🇦🇹',
  at: '🇦🇹',
  serbia: '🇷🇸',
  srb: '🇷🇸',
  rs: '🇷🇸',
  ukraine: '🇺🇦',
  ukr: '🇺🇦',
  ua: '🇺🇦',
  'czech republic': '🇨🇿',
  cze: '🇨🇿',
  cz: '🇨🇿',
  slovakia: '🇸🇰',
  slovenia: '🇸🇮',
  hungary: '🇭🇺',
  romania: '🇷🇴',
  greece: '🇬🇷',
  georgia: '🇬🇪',
  geo: '🇬🇪',
  ge: '🇬🇪',
  'korea, south': '🇰🇷',
  'south korea': '🇰🇷',
  kor: '🇰🇷',
  kr: '🇰🇷',
  japan: '🇯🇵',
  jpn: '🇯🇵',
  jp: '🇯🇵',
  'united states': '🇺🇸',
  usa: '🇺🇸',
  us: '🇺🇸',
  canada: '🇨🇦',
  can: '🇨🇦',
  ca: '🇨🇦',
  mexico: '🇲🇽',
  mex: '🇲🇽',
  mx: '🇲🇽',
  chile: '🇨🇱',
  chi: '🇨🇱',
  cl: '🇨🇱',
  ecuador: '🇪🇨',
  paraguay: '🇵🇾',
  peru: '🇵🇪',
  venezuela: '🇻🇪',
  australia: '🇦🇺',
  aus: '🇦🇺',
  au: '🇦🇺',
  iran: '🇮🇷',
  iraq: '🇮🇶',
  'saudi arabia': '🇸🇦',
  qatar: '🇶🇦',
  russia: '🇷🇺',
  armenia: '🇦🇲',
  albania: '🇦🇱',
  kosovo: '🇽🇰',
  'bosnia-herzegovina': '🇧🇦',
  montenegro: '🇲🇪',
  'north macedonia': '🇲🇰',
  bulgaria: '🇧🇬',
  finland: '🇫🇮',
  iceland: '🇮🇸',
  ireland: '🇮🇪',
  israel: '🇮🇱',
  jamaica: '🇯🇲',
  'costa rica': '🇨🇷',
  'south africa': '🇿🇦',
  'dr congo': '🇨🇩',
  congo: '🇨🇬',
  gabon: '🇬🇦',
  'burkina faso': '🇧🇫',
  'cape verde': '🇨🇻',
  angola: '🇦🇴',
  zambia: '🇿🇲',
  zimbabwe: '🇿🇼',
};

/** Maps a country name, FIFA trigram, or ISO code to a flag emoji. */
export function nationFlag(nation?: string): string {
  if (!nation) return '🌍';
  const normalized = nation.trim().toLowerCase();
  return NATION_FLAGS[normalized] || '🌍';
}

/**
 * Computes the visual rarity tier class for a player or coach lot.
 * When ratings are hidden on the client (`revealRating === false` for footballers),
 * returns `'rarity-mystery'` so hidden server ratings are never leaked through CSS classes.
 */
export function cardRarityClass(
  lot: { id?: string; rating?: number; slot?: string },
  revealRating: boolean,
  era?: string,
): CardRarityClass {
  const isCoachLot = lot.slot === 'COACH';
  if (!isCoachLot && (!revealRating || typeof lot.rating !== 'number')) {
    return era === 'legends' ? 'rarity-legend' : 'rarity-mystery';
  }
  if (era === 'legends' || (typeof lot.id === 'string' && lot.id.startsWith('legends-'))) {
    return 'rarity-legend';
  }
  const rating = typeof lot.rating === 'number' ? lot.rating : 80;
  if (rating >= 93) return 'rarity-superstar';
  if (rating >= 90) return 'rarity-elite';
  if (rating >= 86) return 'rarity-great';
  return 'rarity-standard';
}

const SLOT_SCOUT_TRAITS: Record<string, [string, string]> = {
  GK: ['🧤 Kale Muhafızı', 'Çizgi refleksi ve oyun kurulumunda güven veren eldiven'],
  RB: ['⚡ Çizgi Motoru', 'Sağ koridoru boydan boya kullanan iki yönlü bek'],
  CB1: ['🧱 Hava Hakimiyeti', 'İkili mücadele ve savunma liderliğinde kilit stoper'],
  CB2: ['🛡️ Oyun Kuran Stoper', 'Geriden pas bağlantısı ve kademe sezgisi yüksek'],
  LB: ['🌪️ Sol Koridor Gücü', 'Bindirmeleri ve orta kalitesiyle hücumu genişletir'],
  DM: ['⚓ Orta Saha Çapası', 'Pas arası, pres direnci ve savunma önü sigortası'],
  CM: ['🧭 Tempo Ustası', 'İki ceza sahası arası pas trafiğini yöneten merkez'],
  AM: ['🪄 Kilit Açıcı 10', 'Dar alanda yaratıcılık ve son pas vizyonu yüksek'],
  RW: ['🔥 Ters Ayak Tehdidi', 'İçe kat ederek şut ve asist üreten sağ kanat'],
  LW: ['⚡ Bire Bir Uzmanı', 'Patlayıcı dripling ve arka direk koşularıyla etkili'],
  ST: ['🎯 Ceza Sahası Avcısı', 'Bitiricilik ve savunma arkası koşularda klinik golcü'],
};

/** Builds a scout report badge for both open-rating and hidden-rating (mystery) auction modes. */
export function scoutHintForLot(lot: AuctionLot, revealRating: boolean): ScoutHint {
  if (isCoach(lot)) {
    const specLabel =
      lot.specialty === 'attack'
        ? 'Hücum presi ve gol üretimi'
        : lot.specialty === 'defense'
          ? 'Blok yerleşimi ve az gol yeme'
          : lot.specialty === 'development'
            ? 'Genç ve potansiyelli kadro gelişimi'
            : lot.specialty === 'motivation'
              ? 'Büyük maç psikolojisi ve geri dönüş'
              : 'Hatlar arası taktik denge';
    return {
      badge: `🧠 Taktik Ekol · ${lot.preferredFormation}`,
      detail: `${specLabel} odaklı kenar yönetimi`,
    };
  }

  const [roleBadge, roleDetail] = SLOT_SCOUT_TRAITS[lot.slot] || ['⚽ Kadro Parçası', 'Taktik rotasyon oyuncusu'];
  if (revealRating && typeof lot.rating === 'number') {
    const tier = ratingLevel(lot.rating);
    const tierIcon =
      tier === 'Süperstar' ? '👑' : tier === 'Elit' ? '🌟' : tier === 'Çok iyi' ? '💎' : tier === 'İyi' ? '⚡' : '🛡️';
    return {
      badge: `${tierIcon} ${tier} · ${roleBadge.replace(/^[^\s]+\s/, '')}`,
      detail: roleDetail,
    };
  }

  const prestigeNote =
    lot.price >= 55
      ? 'Üst düzey vitrin tecrübesi · Yüksek beklenti'
      : lot.price >= 35
        ? 'İstikrarlı ilk 11 profili · Dengeli yatırım'
        : 'Keşfedilmeye açık profil · Sürpriz potansiyel';
  return {
    badge: `🕵️ Gözlemci Raporu · ${roleBadge.replace(/^[^\s]+\s/, '')}`,
    detail: `${prestigeNote} — ${roleDetail}`,
  };
}

/** Classifies a completed transfer into a celebratory stamp. */
export function evaluateTransferStamp(
  amount: number,
  openingPrice: number,
  startingBudget = 1000,
  remainingSeconds?: number,
): TransferStamp {
  if (amount >= Math.max(260, startingBudget * 0.3)) {
    return { code: 'record', label: 'REKOR BONSERVİS', icon: '🔥' };
  }
  if (amount <= openingPrice + 5) {
    return { code: 'bargain', label: 'KELEPİR TRANSFER', icon: '💎' };
  }
  if (typeof remainingSeconds === 'number' && remainingSeconds <= 3) {
    return { code: 'snipe', label: 'SON SANİYE ÇALIMI', icon: '⚡' };
  }
  return { code: 'fair', label: 'KADROYA KATILDI', icon: '✓' };
}

const ADJACENT_PITCH_PAIRS: ReadonlyArray<readonly [Slot, Slot]> = [
  ['GK', 'CB1'],
  ['GK', 'CB2'],
  ['RB', 'CB1'],
  ['CB1', 'CB2'],
  ['CB2', 'LB'],
  ['RB', 'RW'],
  ['LB', 'LW'],
  ['CB1', 'DM'],
  ['CB2', 'DM'],
  ['CB1', 'CM'],
  ['CB2', 'CM'],
  ['DM', 'CM'],
  ['DM', 'AM'],
  ['CM', 'AM'],
  ['AM', 'RW'],
  ['AM', 'LW'],
  ['AM', 'ST'],
  ['RW', 'ST'],
  ['LW', 'ST'],
];

/**
 * Calculates tactical & club/league/nation chemistry links between adjacent pitch slots.
 */
export function computePitchChemistry(
  squad: Partial<Record<Slot, Footballer>>,
  formation = '4-2-3-1',
  coach?: Coach | null,
): PitchChemistryReport {
  const positions =
    (FORMATION_POSITIONS as Record<string, Record<Slot, { left: string; top: string }>>)[formation] ||
    FORMATION_POSITIONS['4-2-3-1'];
  const links: ChemistryLink[] = [];
  let rawPoints = 0;

  for (const [from, to] of ADJACENT_PITCH_PAIRS) {
    const a = squad[from];
    const b = squad[to];
    if (!a || !b) continue;

    const sameClub = Boolean(a.club && b.club && a.club === b.club && a.club !== 'Otomatik Atama');
    const sameLeague = Boolean(a.league && b.league && a.league === b.league);
    const sameNation = Boolean(a.nation && b.nation && a.nation === b.nation && a.nation !== '—');

    if (sameClub || (sameLeague && sameNation)) {
      const p1 = positions[from];
      const p2 = positions[to];
      links.push({
        from,
        to,
        x1: Number.parseFloat(p1.left),
        y1: Number.parseFloat(p1.top),
        x2: Number.parseFloat(p2.left),
        y2: Number.parseFloat(p2.top),
        strength: 'strong',
        reason: sameClub ? `Aynı kulüp (${a.club})` : `Aynı lig ve ülke (${a.league})`,
      });
      rawPoints += 14;
    } else if (sameLeague || sameNation) {
      const p1 = positions[from];
      const p2 = positions[to];
      links.push({
        from,
        to,
        x1: Number.parseFloat(p1.left),
        y1: Number.parseFloat(p1.top),
        x2: Number.parseFloat(p2.left),
        y2: Number.parseFloat(p2.top),
        strength: 'medium',
        reason: sameLeague ? `Aynı lig (${a.league})` : `Aynı ülke (${a.nation})`,
      });
      rawPoints += 7;
    }
  }

  const filledCount = Object.keys(squad).length;
  const baseCompletion = Math.round((filledCount / 11) * 40);
  const coachBonus = coach ? (coach.preferredFormation === formation ? 18 : 8) : 0;
  const score = Math.min(100, baseCompletion + coachBonus + rawPoints);

  const label =
    score >= 85 ? 'Kusursuz Uyum' : score >= 68 ? 'Yüksek Kimya' : score >= 45 ? 'Dengeli İskelet' : 'Uyum Gelişiyor';

  return { links, score, label };
}

/**
 * Generates fun, celebratory end-of-night superlatives for the managers at the table.
 */
export function computeNightAwards(ranked: ScoreBreakdown[]): NightAward[] {
  if (!ranked.length) return [];
  const awards: NightAward[] = [];

  // 1. Merkez Bankası — Most remaining budget
  const richest = [...ranked].sort((a, b) => b.budget - a.budget)[0];
  if (richest) {
    awards.push({
      id: 'central-bank',
      icon: '🏦',
      title: 'Merkez Bankası',
      winnerName: richest.name,
      stat: `$${richest.budget}M Kasa`,
      description: 'Mezat masasından kasasında en yüksek nakit rezervle çıkan finans başkanı.',
    });
  }

  // 2. Elmas Göz (F/P Kralı) — Best score per spent million
  const valueLeader = [...ranked].sort((a, b) => {
    const ratioA = a.score / Math.max(50, a.spent);
    const ratioB = b.score / Math.max(50, b.spent);
    return ratioB - ratioA;
  })[0];
  if (valueLeader) {
    const perHundred = ((valueLeader.score / Math.max(50, valueLeader.spent)) * 100).toFixed(1);
    awards.push({
      id: 'diamond-eye',
      icon: '💎',
      title: 'Elmas Göz (F/P Kralı)',
      winnerName: valueLeader.name,
      stat: `${perHundred} Puan / $100M`,
      description: 'Harcadığı her milyon doları en yüksek kadro kalitesine dönüştüren stratejist.',
    });
  }

  // 3. Bonkör Başkan — Highest total investment or single star spend
  const biggestSpender = [...ranked].sort((a, b) => b.spent - a.spent)[0];
  if (biggestSpender && biggestSpender.spent > 0) {
    awards.push({
      id: 'big-spender',
      icon: '💸',
      title: 'Bonkör Başkan',
      winnerName: biggestSpender.name,
      stat: `$${biggestSpender.spent}M Harcama`,
      description: 'Yıldızları kadrosuna katmak için masada kesenin ağzını en çok açan kulüp başkanı.',
    });
  }

  // 4. Taktik Profesörü — Highest combined coach + bench + balance impact
  const tactician = [...ranked].sort((a, b) => {
    const tacA = a.coachBoost + a.benchDepth + a.balance * 0.1;
    const tacB = b.coachBoost + b.benchDepth + b.balance * 0.1;
    return tacB - tacA;
  })[0];
  if (tactician) {
    const tacTotal = (tactician.coachBoost + tactician.benchDepth).toFixed(1);
    awards.push({
      id: 'tactical-prof',
      icon: '🧠',
      title: 'Taktik Profesörü',
      winnerName: tactician.name,
      stat: `+${tacTotal} Taktik Katkı`,
      description: 'Teknik direktör uyumu, kadro dengesi ve yedek kulübesi derinliğinden maksimum verim aldı.',
    });
  }

  return awards;
}

function pickStarAttacker(manager?: Manager): string {
  if (!manager) return 'Yıldız oyuncu';
  return (
    manager.squad.ST?.name ||
    manager.squad.AM?.name ||
    manager.squad.RW?.name ||
    manager.squad.LW?.name ||
    manager.squad.CM?.name ||
    manager.name
  );
}

/** Builds a broadcast-style matchday commentary line using the managers' actual drafted stars. */
export function buildMatchCommentary(match: SimulatedMatch, managers: Manager[], matchNumber: number): string {
  const home = managers.find((m) => m.id === match.homeId);
  const away = managers.find((m) => m.id === match.awayId);
  const homeName = home?.name || `Takım ${match.homeId + 1}`;
  const awayName = away?.name || `Takım ${match.awayId + 1}`;

  if (match.homeGoals > match.awayGoals) {
    const hero = pickStarAttacker(home);
    return `🎙️ ${matchNumber}. Maç: ${homeName} ${match.homeGoals}–${match.awayGoals} ${awayName} · ${hero} galibiyeti getirdi!`;
  }
  if (match.awayGoals > match.homeGoals) {
    const hero = pickStarAttacker(away);
    return `🎙️ ${matchNumber}. Maç: ${homeName} ${match.homeGoals}–${match.awayGoals} ${awayName} · Deplasmanda ${hero} şov yaptı!`;
  }
  const gk = home?.squad.GK?.name || away?.squad.GK?.name || 'Kaleciler';
  return `🎙️ ${matchNumber}. Maç: ${homeName} ${match.homeGoals}–${match.awayGoals} ${awayName} · ${gk} geçit vermedi, puanlar paylaşıldı!`;
}

/** Computes the tournament table after the first `matchLimit` matches for live matchday playback. */
export function computePartialTournamentTable(
  managers: Manager[],
  matches: SimulatedMatch[],
  matchLimit: number,
): TournamentRow[] {
  const ranked = managers.map(scoreManager);
  const activeMatches = matches.slice(0, Math.max(0, matchLimit));
  return ranked
    .map((team) => {
      const games = activeMatches.filter((m) => m.homeId === team.id || m.awayId === team.id);
      let won = 0,
        drawn = 0,
        lost = 0,
        goalsFor = 0,
        goalsAgainst = 0;
      for (const game of games) {
        const isHome = game.homeId === team.id;
        const gf = isHome ? game.homeGoals : game.awayGoals;
        const ga = isHome ? game.awayGoals : game.homeGoals;
        goalsFor += gf;
        goalsAgainst += ga;
        if (gf > ga) won++;
        else if (gf === ga) drawn++;
        else lost++;
      }
      return {
        managerId: team.id,
        name: team.name,
        played: games.length,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        points: won * 3 + drawn,
      };
    })
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
}
