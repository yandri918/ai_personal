import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Volume2, ExternalLink, Activity, Clock } from 'lucide-react';

export default function SportsCard({ apiBase = 'http://localhost:8000', onAskSports }) {
  const [sportsData, setSportsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState('ALL');

  useEffect(() => {
    fetchSportsData();
  }, []);

  const fetchSportsData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/agent/sports`);
      if (res.ok) {
        const data = await res.json();
        setSportsData(data);
      }
    } catch (err) {
      console.warn('Failed to fetch sports data:', err);
    } finally {
      setLoading(false);
    }
  };

  const matches = sportsData?.matches || [];
  const filteredMatches =
    selectedLeague === 'ALL'
      ? matches
      : matches.filter((m) => m.league.toLowerCase().includes(selectedLeague.toLowerCase()));

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>⚽</span> LiveScore — Skor Sepak Bola & Jadwal Pertandingan
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Data langsung via LiveScore.com & DuckDuckGo untuk liga-liga dunia dan kompetisi bergengsi.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchSportsData}
            disabled={loading}
            className="btn-header"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {onAskSports && (
            <button
              onClick={() => onAskSports('Cek skor pertandingan sepak bola terbaru di LiveScore hari ini.')}
              className="btn-tts-listen"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              <Volume2 size={14} />
              <span>Dengarkan via Suara</span>
            </button>
          )}

          <a
            href="https://www.livescore.com/en/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-header"
            style={{ padding: '6px 12px', fontSize: '0.78rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <span>Buka LiveScore.com</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* League Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['ALL', 'Premier League', 'Champions League', 'La Liga', 'Serie A', 'Indonesia'].map((lg) => (
          <button
            key={lg}
            onClick={() => setSelectedLeague(lg)}
            className="chat-quick-chip"
            style={{
              background: selectedLeague === lg ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: selectedLeague === lg ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
              color: selectedLeague === lg ? '#fff' : 'var(--text-muted)',
              fontWeight: selectedLeague === lg ? 700 : 500
            }}
          >
            {lg === 'ALL' ? 'Semua Pertandingan' : lg}
          </button>
        ))}
      </div>

      {/* Matches Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '14px' }}>
        {filteredMatches.map((m, idx) => {
          const isLive = m.status.toLowerCase().includes('live');
          const isFT = m.status === 'FT';

          return (
            <div
              key={idx}
              className="ticker-card"
              style={{
                borderLeft: isLive ? '3px solid #ef4444' : isFT ? '3px solid #10b981' : '3px solid #6366f1',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {m.league}
                </span>

                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: isLive ? 'rgba(239, 68, 68, 0.2)' : isFT ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                    color: isLive ? '#f87171' : isFT ? '#34d399' : '#a5b4fc',
                    border: `1px solid ${isLive ? 'rgba(239, 68, 68, 0.4)' : isFT ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`
                  }}
                >
                  {isLive && <Activity size={11} className="animate-pulse" />}
                  {!isLive && <Clock size={11} />}
                  <span>{m.match_time || m.status}</span>
                </span>
              </div>

              {/* Match Teams & Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
                    {m.home_team}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
                    {m.away_team}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono)',
                    color: isLive ? '#f87171' : '#fff',
                    padding: '4px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    textAlign: 'center',
                    minWidth: '65px'
                  }}
                >
                  {m.score || 'VS'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <a
                  href={m.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.72rem', color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Detail di LiveScore</span>
                  <ExternalLink size={10} />
                </a>

                {onAskSports && (
                  <button
                    onClick={() => onAskSports(`Bagaimana hasil pertandingan ${m.home_team} vs ${m.away_team}?`)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '0.72rem', cursor: 'pointer' }}
                  >
                    Tanya AI 🎙️
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
