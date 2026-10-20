'use client';

import { useEffect, useMemo, useState } from 'react';
import { rankManagers, resultInsights, simulateTournament, type Manager } from '../../lib/game-engine';
import { buildMatchCommentary, computeNightAwards, computePartialTournamentTable } from '../../lib/player-card-flair';
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
  const { ranked, insights, awards } = useMemo(() => {
    const ordered = rankManagers(managers);
    return {
      ranked: ordered,
      insights: resultInsights(ordered),
      awards: computeNightAwards(ordered),
    };
  }, [managers]);
  const tournament = useMemo(() => simulateTournament(managers, 'online-results'), [managers]);
  const [simStep, setSimStep] = useState<number | null>(null);

  useEffect(() => {
    if (simStep === null) return;
    if (simStep >= tournament.matches.length) return;
    const timer = setTimeout(() => {
      setSimStep((prev) => (prev === null ? null : Math.min(tournament.matches.length, prev + 1)));
    }, 1100);
    return () => clearTimeout(timer);
  }, [simStep, tournament.matches.length]);

  const activeTable = useMemo(() => {
    if (simStep === null || simStep >= tournament.matches.length) return tournament.table;
    return computePartialTournamentTable(managers, tournament.matches, simStep);
  }, [managers, simStep, tournament]);

  const activeCommentary = useMemo(() => {
    if (simStep === null || simStep === 0) return null;
    const idx = Math.min(simStep, tournament.matches.length) - 1;
    const match = tournament.matches[idx];
    return match ? buildMatchCommentary(match, managers, idx + 1) : null;
  }, [managers, simStep, tournament.matches]);

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
              <span>Yedek etkisi +{manager.benchDepth}</span>
              <span>Teknik direktör etkisi +{manager.coachBoost}</span>
            </p>
          </article>
        ))}
      </div>
      {awards.length > 0 && (
        <section className="mz-awards-section" aria-label="Gecenin özel ödülleri">
          <p className="eyebrow">GECENİN ÖZEL ÖDÜLLERİ</p>
          <div className="mz-awards-grid">
            {awards.map((award) => (
              <div key={award.id} className="mz-award-card">
                <span className="mz-award-icon" aria-hidden="true">
                  {award.icon}
                </span>
                <div>
                  <small>{award.title}</small>
                  <b>{award.winnerName}</b>
                  <strong>{award.stat}</strong>
                  <p>{award.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {tournament.table.length > 2 && (
        <section className="tournament">
          <div className="mz-tournament-head">
            <p className="eyebrow">MUHTEMEL MİNİ LİG</p>
            <button type="button" className="mz-sim-btn" onClick={() => setSimStep(0)}>
              {simStep !== null && simStep < tournament.matches.length
                ? `⚽ Oynanıyor (${simStep}/${tournament.matches.length})`
                : '⚽ Mini Ligi Canlı Oynat'}
            </button>
          </div>
          {activeCommentary && (
            <div className="mz-match-ticker" role="status" aria-live="polite">
              {activeCommentary}
            </div>
          )}
          <div className="tournament-table">
            <b>#</b>
            <b>Takım</b>
            <b>O</b>
            <b>AV</b>
            <b>P</b>
            {activeTable.map((row, index) => (
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
