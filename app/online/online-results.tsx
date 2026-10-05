'use client';

import { useMemo, useState } from 'react';
import { rankManagers, resultInsights, simulateTournament, type Manager } from '../../lib/game-engine';
import { shareResultCard } from '../../lib/result-card';
import { money, type Room } from './view-types';

export function OnlineResults({
  managers,
  audit,
  onRematch,
  season,
}: {
  managers: Manager[];
  audit: string[];
  onRematch?: () => Promise<boolean>;
  season?: Room['season'];
}) {
  const [shareError, setShareError] = useState('');
  const { ranked, insights } = useMemo(() => {
    const ordered = rankManagers(managers);
    return { ranked: ordered, insights: resultInsights(ordered) };
  }, [managers]);
  const tournament = useMemo(() => simulateTournament(managers, 'online-results'), [managers]);

  async function shareCard() {
    setShareError('');
    try {
      await shareResultCard(ranked);
    } catch {
      setShareError('Sonuç kartı oluşturulamadı. Lütfen tekrar deneyin.');
    }
  }

  return (
    <section className="online-results">
      <p className="eyebrow">ODA SONUCU</p>
      <h1>{ranked[0]?.name} kazandı</h1>
      {ranked[1] && (
        <section className="result-analysis online-result-analysis">
          <div>
            <p className="eyebrow">SIRALAMA ANALİZİ</p>
            <h2>Neden birinci ve ikinci oldular?</h2>
            <p>{insights.winner}</p>
            <p>{insights.runnerUp}</p>
          </div>
          <aside>
            <span>MUHTEMEL MAÇ</span>
            <strong>{insights.match.scoreLine}</strong>
            <p>{insights.match.summary}</p>
          </aside>
        </section>
      )}
      <div>
        {ranked.map((manager, index) => (
          <article key={manager.id}>
            <span>#{index + 1}</span>
            <h2>{manager.name}</h2>
            <strong>{manager.score.toFixed(2)}</strong>
            <p>
              Ortalama {manager.avg} · Kalan {money(manager.budget)} · Kadro {Object.keys(manager.squad).length}/11
              {manager.bench ? ` · Yedek ${Object.keys(manager.bench).length}/4 · Derinlik +${manager.benchDepth}` : ''}
            </p>
            <p>
              Teknik direktör: {manager.coach?.name || 'Yok'}
              {manager.coach ? ` · +${manager.coachBoost} takım puanı · %${manager.coachFit} uyum` : ''}
            </p>
            <p className="result-impact">
              <b>İlk 11 etkisi {manager.starterImpact}</b>
              <span>Yedek etkisi +${manager.benchDepth}</span>
              <span>Teknik direktör etkisi +${manager.coachBoost}</span>
            </p>
          </article>
        ))}
      </div>
      {tournament.table.length > 2 && (
        <section className="tournament">
          <p className="eyebrow">MUHTEMEL MİNİ LİG</p>
          <div className="tournament-table">
            <b>#</b>
            <b>Takım</b>
            <b>O</b>
            <b>AV</b>
            <b>P</b>
            {tournament.table.map((row, index) => (
              <span key={row.managerId} className="tournament-row">
                <i>{index + 1}</i>
                <strong>{row.name}</strong>
                <i>{row.played}</i>
                <i>{row.goalDifference}</i>
                <b>{row.points}</b>
              </span>
            ))}
          </div>
          <small>
            Sonuçlar kadro, hat eşleşmeleri ve teknik direktör uyumundan deterministik olarak üretilen oyun tahminidir.
          </small>
        </section>
      )}
      {season && season.length > 1 && (
        <section className="tournament">
          <p className="eyebrow">
            SEZON · {season.round}/{season.length}
          </p>
          <div className="season-list">
            {Object.values(season.standings)
              .sort((a, b) => b.points - a.points || b.totalScore - a.totalScore)
              .map((row, index) => (
                <p key={row.name}>
                  <b>
                    {index + 1}. {row.name}
                  </b>
                  <span>
                    {row.points} puan · {row.wins} galibiyet
                  </span>
                </p>
              ))}
          </div>
        </section>
      )}
      {audit.length > 0 && (
        <details className="result-audit">
          <summary>Oyun kararları ve otomatik atamalar</summary>
          {audit.map((item, index) => (
            <p key={`${item}-${index}`}>{item}</p>
          ))}
        </details>
      )}
      <button className="share-card" onClick={() => void shareCard()}>
        ↗ Sonuç kartını paylaş
      </button>
      {shareError && (
        <p className="share-error" role="alert">
          {shareError}
        </p>
      )}
      {onRematch && (
        <button className="start mx-auto mt-4" onClick={onRematch}>
          Aynı menajerlerle rövanş <span>↻</span>
        </button>
      )}
      <p>Bu sonuç odada 7 gün boyunca saklanır.</p>
    </section>
  );
}
