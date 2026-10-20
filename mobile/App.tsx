import { useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  auctionOpeningPrice,
  buildSoloManagerNames,
  canPlaceLotBid,
  COACHES,
  computeNightAwards,
  computePitchChemistry,
  decideSoloBotTurn,
  isCoach,
  nationFlag,
  rankManagers,
  ratingLevel,
  scoutHintForLot,
  soloBotStyleForIndex,
  type AuctionLot,
  type Footballer,
  type Manager,
  type Slot,
} from '../packages/core/index.ts';
import { parseMezatDeepLink, shareRoomInviteNative, triggerBidHaptic, triggerSoldHaptic } from './src/native-bridge.ts';

const MOBILE_FALLBACK_POOL: Footballer[] = [
  {
    id: 'm-gk-1',
    name: 'Alisson',
    slot: 'GK',
    role: 'Kaleci',
    rating: 91,
    price: 65,
    nation: 'BRA',
    club: 'Liverpool',
  },
  {
    id: 'm-gk-2',
    name: 'Thibaut Courtois',
    slot: 'GK',
    role: 'Kaleci',
    rating: 92,
    price: 70,
    nation: 'BEL',
    club: 'Real Madrid',
  },
  {
    id: 'm-rb-1',
    name: 'Achraf Hakimi',
    slot: 'RB',
    role: 'Sağ Bek',
    rating: 90,
    price: 65,
    nation: 'MAR',
    club: 'PSG',
  },
  {
    id: 'm-cb1-1',
    name: 'Virgil van Dijk',
    slot: 'CB1',
    role: 'Stoper',
    rating: 92,
    price: 75,
    nation: 'NED',
    club: 'Liverpool',
  },
  {
    id: 'm-cb2-1',
    name: 'William Saliba',
    slot: 'CB2',
    role: 'Stoper',
    rating: 90,
    price: 70,
    nation: 'FRA',
    club: 'Arsenal',
  },
  {
    id: 'm-lb-1',
    name: 'Theo Hernández',
    slot: 'LB',
    role: 'Sol Bek',
    rating: 89,
    price: 60,
    nation: 'FRA',
    club: 'Milan',
  },
  {
    id: 'm-dm-1',
    name: 'Rodri',
    slot: 'DM',
    role: 'Ön Libero',
    rating: 94,
    price: 90,
    nation: 'ESP',
    club: 'Man City',
  },
  {
    id: 'm-cm-1',
    name: 'Jude Bellingham',
    slot: 'CM',
    role: 'Merkez Orta Saha',
    rating: 93,
    price: 95,
    nation: 'ENG',
    club: 'Real Madrid',
  },
  {
    id: 'm-am-1',
    name: 'Jamal Musiala',
    slot: 'AM',
    role: 'On Numara',
    rating: 91,
    price: 85,
    nation: 'GER',
    club: 'Bayern',
  },
  {
    id: 'm-rw-1',
    name: 'Lamine Yamal',
    slot: 'RW',
    role: 'Sağ Kanat',
    rating: 92,
    price: 95,
    nation: 'ESP',
    club: 'Barcelona',
  },
  {
    id: 'm-lw-1',
    name: 'Vinícius Júnior',
    slot: 'LW',
    role: 'Sol Kanat',
    rating: 94,
    price: 100,
    nation: 'BRA',
    club: 'Real Madrid',
  },
  {
    id: 'm-st-1',
    name: 'Erling Haaland',
    slot: 'ST',
    role: 'Santrfor',
    rating: 95,
    price: 105,
    nation: 'NOR',
    club: 'Man City',
  },
];

export default function Mezat11MobileApp() {
  const [screen, setScreen] = useState<'home' | 'solo' | 'online' | 'results'>('home');
  const [playerName, setPlayerName] = useState('Yasin');
  const [roomCode, setRoomCode] = useState('');
  const [pool] = useState<AuctionLot[]>(() => [...MOBILE_FALLBACK_POOL, ...COACHES.slice(0, 3)]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [index, setIndex] = useState(0);
  const [bid, setBid] = useState(0);
  const [leader, setLeader] = useState<number | null>(null);
  const [passed, setPassed] = useState<number[]>([]);
  const [activeTurn, setActiveTurn] = useState<number | null>(null);
  const [feed, setFeed] = useState<string[]>([]);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      const parsed = parseMezatDeepLink(url);
      if (parsed.roomCode) {
        setRoomCode(parsed.roomCode);
        setScreen('online');
      } else if (parsed.mode === 'solo') {
        setScreen('solo');
      }
    });
    const sub = Linking.addEventListener('url', (event) => {
      const parsed = parseMezatDeepLink(event.url);
      if (parsed.roomCode) {
        setRoomCode(parsed.roomCode);
        setScreen('online');
      }
    });
    return () => sub.remove();
  }, []);

  const current = pool[index];
  const openingPrice = current ? auctionOpeningPrice(current, managers) : 5;

  function startSoloAuction() {
    const names = buildSoloManagerNames(playerName, 4);
    const initialManagers: Manager[] = names.map((n, i) => ({
      id: i,
      name: n,
      budget: 850,
      spent: 0,
      squad: {},
    }));
    setManagers(initialManagers);
    setIndex(0);
    setBid(0);
    setLeader(null);
    setPassed([]);
    setActiveTurn(0);
    setFeed(['Solo AI Mezat başladı. Sizin sıranız!']);
    setScreen('solo');
  }

  function nextEligibleTurn(
    after: number,
    offer: number,
    nextPassed: number[],
    nextLeader: number | null,
    ms = managers,
    lot = current,
  ): number | null {
    if (!lot) return null;
    for (let step = 1; step <= ms.length; step++) {
      const id = (after + step) % ms.length;
      if (id !== nextLeader && canPlaceLotBid(ms[id], lot, offer, id, nextPassed)) return id;
    }
    return null;
  }

  function placeBid(inc: number) {
    if (activeTurn === null || !current) return;
    const id = activeTurn;
    const m = managers[id];
    const next = leader === null ? openingPrice : bid + inc;
    if (!canPlaceLotBid(m, current, next, id, passed)) return;
    void triggerBidHaptic(next);
    setBid(next);
    setLeader(id);
    setFeed((f) => [`${m.name}, $${next}M teklif verdi.`, ...f].slice(0, 5));
    setActiveTurn(nextEligibleTurn(id, next + 5, passed, id));
  }

  function passTurn() {
    if (activeTurn === null || !current) return;
    const id = activeTurn;
    const nextPassed = [...passed, id];
    setPassed(nextPassed);
    setFeed((f) => [`${managers[id].name} pas geçti.`, ...f].slice(0, 5));
    const next = nextEligibleTurn(id, leader === null ? openingPrice : bid + 5, nextPassed, leader);
    if (next === null) {
      finalizeLot(leader, bid);
      return;
    }
    setActiveTurn(next);
  }

  function finalizeLot(winnerId: number | null, finalBid: number) {
    if (!current) return;
    let updated = managers;
    if (winnerId !== null) {
      void triggerSoldHaptic();
      updated = managers.map((m) =>
        m.id === winnerId
          ? isCoach(current)
            ? { ...m, budget: m.budget - finalBid, spent: m.spent + finalBid, coach: current }
            : {
                ...m,
                budget: m.budget - finalBid,
                spent: m.spent + finalBid,
                squad: { ...m.squad, [current.slot as Slot]: current },
              }
          : m,
      );
      setManagers(updated);
    }
    const nextIndex = index + 1;
    if (nextIndex >= pool.length) {
      setScreen('results');
      return;
    }
    setIndex(nextIndex);
    setBid(0);
    setLeader(null);
    setPassed([]);
    setActiveTurn(0);
  }

  useEffect(() => {
    if (screen !== 'solo' || !current) return;
    if (activeTurn !== null && activeTurn > 0) {
      const timer = setTimeout(() => {
        const decision = decideSoloBotTurn({
          managers,
          pool,
          index,
          bid,
          leader,
          passed,
          botIndex: activeTurn,
          style: soloBotStyleForIndex(activeTurn),
        });
        if (decision.action === 'bid') placeBid(decision.increment);
        else passTurn();
      }, 480);
      return () => clearTimeout(timer);
    }
    if (activeTurn === null && leader !== null) {
      const timer = setTimeout(() => {
        finalizeLot(leader, bid);
      }, 600);
      return () => clearTimeout(timer);
    }
  });

  const ranked = useMemo(() => rankManagers(managers), [managers]);
  const awards = useMemo(() => computeNightAwards(ranked), [ranked]);
  const myChemistry = useMemo(() => computePitchChemistry(managers[0]?.squad || {}, '4-2-3-1'), [managers]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brand}>MEZAT 11 · MOBILE</Text>
          {screen !== 'home' && (
            <Pressable style={styles.backBtn} onPress={() => setScreen('home')}>
              <Text style={styles.backText}>Ana Ekran</Text>
            </Pressable>
          )}
        </View>

        {screen === 'home' && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>CANLI FUTBOL AÇIK ARTIRMASI</Text>
            <Text style={styles.heroTitle}>Bütçeni yönet. Rüya kadronu kur.</Text>
            <TextInput
              style={styles.input}
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Menajer adınız"
              placeholderTextColor="#71717a"
              maxLength={24}
            />
            <Pressable style={styles.primaryBtn} onPress={startSoloAuction}>
              <Text style={styles.primaryBtnText}>🤖 AI Botlara Karşı Solo Başla →</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => setScreen('online')}>
              <Text style={styles.secondaryBtnText}>🌐 Arkadaşlarla Online Oda →</Text>
            </Pressable>
          </View>
        )}

        {screen === 'online' && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>ÇOK OYUNCULU ODA</Text>
            <Text style={styles.heroTitle}>Oda Kodu veya QR ile Katıl</Text>
            <TextInput
              style={styles.input}
              value={roomCode}
              onChangeText={(t) => setRoomCode(t.toUpperCase())}
              placeholder="6 Haneli Oda Kodu (Örn. ABC234)"
              placeholderTextColor="#71717a"
              maxLength={6}
              autoCapitalize="characters"
            />
            {roomCode.length >= 4 && (
              <Pressable style={styles.secondaryBtn} onPress={() => void shareRoomInviteNative(roomCode)}>
                <Text style={styles.secondaryBtnText}>↗ Oda Davetini Paylaş ({roomCode})</Text>
              </Pressable>
            )}
          </View>
        )}

        {screen === 'solo' && current && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              LOT {index + 1}/{pool.length} · KİMYA %{myChemistry.score}
            </Text>
            <Text style={styles.heroTitle}>
              {nationFlag(current.nation)} {current.name}
            </Text>
            <Text style={styles.subtitle}>
              {current.role} · {ratingLevel(current.rating)} · {scoutHintForLot(current, false).badge}
            </Text>
            <Text style={styles.bidValue}>${leader === null ? openingPrice : bid}M</Text>
            <Text style={styles.subtitle}>
              {leader === null ? 'Açılış teklifi bekleniyor' : `Lider: ${managers[leader]?.name}`}
            </Text>
            <View style={styles.bidRow}>
              {leader === null ? (
                <Pressable style={styles.primaryBtn} disabled={activeTurn !== 0} onPress={() => placeBid(0)}>
                  <Text style={styles.primaryBtnText}>${openingPrice}M Teklif Ver</Text>
                </Pressable>
              ) : (
                [5, 10, 25].map((inc) => (
                  <Pressable
                    key={inc}
                    style={styles.bidStepBtn}
                    disabled={activeTurn !== 0}
                    onPress={() => placeBid(inc)}
                  >
                    <Text style={styles.primaryBtnText}>+${inc}M</Text>
                  </Pressable>
                ))
              )}
              <Pressable style={styles.passBtn} disabled={activeTurn !== 0} onPress={passTurn}>
                <Text style={styles.secondaryBtnText}>Pas</Text>
              </Pressable>
            </View>
            {feed.map((line, i) => (
              <Text key={i} style={styles.feedLine}>
                {line}
              </Text>
            ))}
          </View>
        )}

        {screen === 'results' && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>MEZAT TAMAMLANDI</Text>
            <Text style={styles.heroTitle}>Şampiyon: {ranked[0]?.name}</Text>
            {awards.map((award) => (
              <Text key={award.id} style={styles.feedLine}>
                {award.icon} {award.title}: {award.winnerName} ({award.stat})
              </Text>
            ))}
            <Pressable style={styles.primaryBtn} onPress={startSoloAuction}>
              <Text style={styles.primaryBtnText}>Yeni Solo Mezat Kur ↻</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090e' },
  scroll: { flex: 1, paddingHorizontal: 18, paddingVertical: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  brand: { color: '#d8ff3e', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  backText: { color: '#e4e4e7', fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#10141f',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22293a',
    marginBottom: 16,
  },
  eyebrow: { color: '#d8ff3e', fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 8 },
  heroTitle: { color: '#ffffff', fontSize: 26, fontWeight: '900', marginBottom: 10 },
  subtitle: { color: '#a1a1aa', fontSize: 13, marginBottom: 8 },
  bidValue: { color: '#d8ff3e', fontSize: 38, fontWeight: '900', marginVertical: 6 },
  input: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 14,
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 10,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: '#d8ff3e',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnText: { color: '#07090e', fontSize: 14, fontWeight: '900' },
  secondaryBtn: {
    backgroundColor: '#181f30',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { color: '#f4f4f5', fontSize: 14, fontWeight: '700' },
  bidRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 14 },
  bidStepBtn: {
    flex: 1,
    backgroundColor: '#d8ff3e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  passBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#27272a',
    alignItems: 'center',
  },
  feedLine: { color: '#d4d4d8', fontSize: 12, marginTop: 4 },
});
