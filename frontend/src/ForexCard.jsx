import React from 'react';
import { ArrowUpRight, ArrowDownRight, DollarSign, RefreshCw, Volume2 } from 'lucide-react';

export default function ForexCard({ marketItems = [], onAskCurrency }) {
  // Find specific currency items
  const usd = marketItems.find((i) => i.symbol === 'IDR=X') || {
    name: 'USD / IDR (Dolar AS)',
    symbol: 'IDR=X',
    price: 17900.0,
    change: 92.5,
    change_percent: 0.52,
    trend: 'up',
    currency: 'IDR'
  };

  const jpy = marketItems.find((i) => i.symbol === 'JPYIDR=X') || {
    name: 'JPY / IDR (Yen Jepang)',
    symbol: 'JPYIDR=X',
    price: 112.82,
    change: 0.16,
    change_percent: 0.14,
    trend: 'up',
    currency: 'IDR'
  };

  const aud = marketItems.find((i) => i.symbol === 'AUDIDR=X') || {
    name: 'AUD / IDR (Dolar Australia)',
    symbol: 'AUDIDR=X',
    price: 12478.10,
    change: 90.92,
    change_percent: 0.73,
    trend: 'up',
    currency: 'IDR'
  };

  const currencies = [
    {
      flag: '🇺🇸',
      code: 'USD / IDR',
      label: 'Dolar Amerika Serikat',
      data: usd,
      unit: '1 USD'
    },
    {
      flag: '🇯🇵',
      code: 'JPY / IDR',
      label: 'Yen Jepang',
      data: jpy,
      unit: '1 JPY'
    },
    {
      flag: '🇦🇺',
      code: 'AUD / IDR',
      label: 'Dolar Australia',
      data: aud,
      unit: '1 AUD'
    }
  ];

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>💱</span> Kurs Mata Uang Harian (Valuta Asing)
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Data pergerakan kurs real-time Dolar AS, Yen Jepang, dan Dolar Australia terhadap Rupiah.
          </p>
        </div>
        {onAskCurrency && (
          <button
            onClick={() => onAskCurrency('Berapa kurs Dolar AS, Yen Jepang, dan Dolar Australia hari ini?')}
            className="btn-tts-listen"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <Volume2 size={14} />
            <span>Tanyakan via Suara</span>
          </button>
        )}
      </div>

      <div className="forex-grid-container">
        {currencies.map((curr, idx) => {
          const item = curr.data;
          const isUp = item.trend === 'up';
          const isDown = item.trend === 'down';

          return (
            <div key={idx} className="forex-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="forex-card-flag">{curr.flag}</div>
                  <div className="forex-card-title">{curr.label}</div>
                  <div className="forex-card-code">{curr.code} ({curr.unit})</div>
                </div>
                <span className={`forex-change-badge ${item.trend}`}>
                  {isUp && <ArrowUpRight size={13} />}
                  {isDown && <ArrowDownRight size={13} />}
                  <span>{item.change_percent >= 0 ? `+${item.change_percent}%` : `${item.change_percent}%`}</span>
                </span>
              </div>

              <div style={{ marginTop: '12px' }}>
                <div className="forex-card-rate">
                  Rp {item.price.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.76rem', color: item.change >= 0 ? '#34d399' : '#fb7185', marginTop: '4px' }}>
                  Perubahan: {item.change >= 0 ? `+Rp ${item.change.toFixed(2)}` : `-Rp ${Math.abs(item.change).toFixed(2)}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
