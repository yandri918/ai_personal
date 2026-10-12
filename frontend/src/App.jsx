import React, { useState, useEffect, useRef } from 'react';
import VoiceChat from './VoiceChat';
import ForexCard from './ForexCard';
import SportsCard from './SportsCard';
import {
  Brain,
  Mail,
  TrendingUp,
  CloudSun,
  Lightbulb,
  User,
  Send,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Terminal,
  ShieldCheck,
  ChevronRight,
  Droplets,
  Wind,
  Sun,
  Compass,
  DollarSign,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  MessageSquare,
  Coins
} from 'lucide-react';

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '5173')
  ? 'http://localhost:8000'
  : '';

export default function App() {
  const [query, setQuery] = useState('Cek kondisi email masuk, pergerakan pasar finansial terkini, cuaca hari ini, dan berikan saran terbaik untuk saya.');
  const [city, setCity] = useState('Jakarta');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showLogs, setShowLogs] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Audio Voice State
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const audioPlayerRef = useRef(null);

  // Agent hierarchy live states: idle | running | done
  const [agentStatus, setAgentStatus] = useState({
    user: 'idle',
    supervisor: 'idle',
    email: 'idle',
    market: 'idle',
    weather: 'idle',
    advisor: 'idle',
  });

  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState({ gemini_active: true, gemini_model: 'gemini-2.0-flash' });
  const [emailConn, setEmailConn] = useState({ connected: false, label: 'Belum Terhubung', type: 'none' });
  const [oauthLoading, setOauthLoading] = useState(false);
  const [imapLoading, setImapLoading] = useState(false);
  const [imapFeedback, setImapFeedback] = useState(null);

  // Settings State
  const [settingsData, setSettingsData] = useState({
    gemini_api_key: '',
    elevenlabs_api_key: '',
    elevenlabs_voice_id: '21m00Tcm4TlvDq8ikWAM',
    email_user: '',
    email_password: '',
    default_city: 'Jakarta'
  });

  const logsEndRef = useRef(null);

  useEffect(() => {
    fetchHealth();
    fetchEmailStatus();
    fetchSettings();
    // Auto-run first briefing on mount
    handleExecute('Cek kondisi email masuk, pergerakan pasar finansial terkini, cuaca hari ini, dan berikan saran terbaik untuk saya.');
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // Backend starting
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettingsData(prev => ({
          ...prev,
          email_user: data.email_user || '',
          default_city: data.default_city || 'Jakarta',
          elevenlabs_voice_id: data.elevenlabs_voice_id || prev.elevenlabs_voice_id
        }));
      }
    } catch {
      // Ignore
    }
  };

  const fetchEmailStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/google/status`);
      if (res.ok) {
        const data = await res.json();
        setEmailConn(data);
      }
    } catch {
      // Ignore
    }
  };

  const handleGoogleConnect = async () => {
    setOauthLoading(true);
    try {
      alert("Browser Anda akan membuka jendela Login Google resmi. Silakan pilih akun Google pribadi Anda dan izinkan akses baca email (Gmail).");
      const res = await fetch(`${API_BASE}/api/auth/google/login`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'authenticated') {
        alert("Berhasil terhubung ke Akun Google pribadi!");
        await fetchEmailStatus();
        handleExecute();
      }
    } catch (e) {
      alert("Gagal menghubungkan Google: " + e.message);
    } finally {
      setOauthLoading(false);
    }
  };

  const handleImapConnect = async () => {
    if (!settingsData.email_user || !settingsData.email_password) {
      setImapFeedback({ type: 'error', message: 'Silakan isi Alamat Email dan Google App Password (16 karakter).' });
      return;
    }
    setImapLoading(true);
    setImapFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/imap/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_user: settingsData.email_user,
          email_password: settingsData.email_password
        })
      });
      const data = await res.json();
      if (res.ok) {
        setImapFeedback({ type: 'success', message: data.message });
        await fetchEmailStatus();
        handleExecute();
      } else {
        setImapFeedback({ type: 'error', message: data.detail || 'Koneksi IMAP gagal.' });
      }
    } catch (e) {
      setImapFeedback({ type: 'error', message: 'Gagal menghubungi server: ' + e.message });
    } finally {
      setImapLoading(false);
    }
  };

  const handleEmailDisconnect = async () => {
    if (!confirm("Putus koneksi akun email pribadi?")) return;
    try {
      await fetch(`${API_BASE}/api/auth/disconnect`, { method: 'POST' });
      await fetchEmailStatus();
      setImapFeedback(null);
      handleExecute();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecute = async (customQuery) => {
    const q = customQuery || query;
    if (!q.trim() || loading) return;

    // Stop audio if playing
    stopAudio();

    setLoading(true);
    setLogs([]);
    setResult(null);

    // Initial agent visual states
    setAgentStatus({
      user: 'active',
      supervisor: 'running',
      email: 'idle',
      market: 'idle',
      weather: 'idle',
      advisor: 'idle',
    });

    try {
      const response = await fetch(`${API_BASE}/api/agent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          city: city,
          force_all_agents: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawJson = line.replace('data: ', '').trim();
            if (!rawJson) continue;
            try {
              const parsed = JSON.parse(rawJson);

              if (parsed.type === 'log') {
                const logItem = parsed.data;
                setLogs((prev) => [...prev, logItem]);

                const agentName = logItem.agent.toLowerCase();
                setAgentStatus((prev) => {
                  const updated = { ...prev };
                  if (agentName.includes('supervisor')) {
                    updated.supervisor = 'running';
                  }
                  if (agentName.includes('email')) {
                    updated.email = logItem.status === 'success' ? 'done' : 'running';
                  }
                  if (agentName.includes('market')) {
                    updated.market = logItem.status === 'success' ? 'done' : 'running';
                  }
                  if (agentName.includes('weather')) {
                    updated.weather = logItem.status === 'success' ? 'done' : 'running';
                  }
                  if (agentName.includes('advisor')) {
                    updated.advisor = logItem.status === 'success' ? 'done' : 'running';
                  }
                  return updated;
                });
              } else if (parsed.type === 'result') {
                setResult(parsed.data);
                setAgentStatus({
                  user: 'done',
                  supervisor: 'done',
                  email: 'done',
                  market: 'done',
                  weather: 'done',
                  advisor: 'done',
                });
              }
            } catch (err) {
              console.error('Error parsing SSE line:', err);
            }
          }
        }
      }
    } catch (err) {
      console.warn('SSE stream failed, falling back to one-shot endpoint:', err);
      try {
        const res = await fetch(`${API_BASE}/api/agent/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, city: city })
        });
        const data = await res.json();
        setResult(data);
        if (data.logs) setLogs(data.logs);
        setAgentStatus({
          user: 'done',
          supervisor: 'done',
          email: 'done',
          market: 'done',
          weather: 'done',
          advisor: 'done',
        });
      } catch (fallbackErr) {
        console.error('Both execution methods failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const stopAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingVoice(false);
    setVoiceLoading(false);
  };

  const playVoiceBriefing = async () => {
    if (isPlayingVoice) {
      stopAudio();
      return;
    }

    if (!result?.final_synthesis) return;

    setVoiceLoading(true);

    // Clean text for speech
    const cleanSpeech = result.final_synthesis
      .replace(/[#*`_\[\]()>-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      // 1. Try ElevenLabs TTS via Backend
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanSpeech })
      });

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;

        audio.onended = () => {
          setIsPlayingVoice(false);
          setVoiceLoading(false);
        };
        audio.onerror = () => {
          fallbackBrowserSpeech(cleanSpeech);
        };

        await audio.play();
        setIsPlayingVoice(true);
        setVoiceLoading(false);
        return;
      } else {
        // Fallback to browser SpeechSynthesis
        fallbackBrowserSpeech(cleanSpeech);
      }
    } catch {
      fallbackBrowserSpeech(cleanSpeech);
    }
  };

  const fallbackBrowserSpeech = (text) => {
    if (!('speechSynthesis' in window)) {
      alert('Browser Anda tidak mendukung Web Speech API.');
      setVoiceLoading(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.05;

    // Pick Indonesian voice if available
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.includes('id') || v.lang.includes('ID'));
    if (idVoice) utterance.voice = idVoice;

    utterance.onstart = () => {
      setIsPlayingVoice(true);
      setVoiceLoading(false);
    };
    utterance.onend = () => {
      setIsPlayingVoice(false);
    };
    utterance.onerror = () => {
      setIsPlayingVoice(false);
      setVoiceLoading(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const saveSettings = async () => {
    try {
      await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData)
      });
      setShowSettings(false);
      await fetchHealth();
      await fetchSettings();
      await fetchEmailStatus();
    } catch (e) {
      console.error('Save settings failed:', e);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <Brain size={24} color="#ffffff" />
          </div>
          <div>
            <h1 className="brand-title">AURA Multi-Agent OS</h1>
            <p className="brand-subtitle">Hierarchical Autonomous Personal Assistant</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="status-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'var(--border-active)', color: '#a5b4fc' }}>
            <Sparkles size={14} color="#818cf8" />
            <span>Gemini 3.8 Flash Active</span>
          </div>

          <button
            className="btn-header"
            onClick={() => handleExecute()}
            disabled={loading}
            title="Muat Ulang Pipeline Agen"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn-header"
            onClick={() => setShowSettings(true)}
            title="Konfigurasi API & Akun"
          >
            <Sliders size={15} />
            <span>Kredensial</span>
          </button>
        </div>
      </header>

      {/* Multi-Agent Hierarchy Interactive Diagram */}
      <section className="hierarchy-card">
        <div className="hierarchy-header">
          <div className="hierarchy-title">
            <Compass size={16} color="#6366f1" />
            <span>Arsitektur Hierarki Multi-Agent</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            User ➔ Supervisor ➔ [Email | Market | Weather | Advisor]
          </span>
        </div>

        <div className="agent-tree">
          {/* Level 0: User */}
          <div className="tree-level-user">
            <div className={`agent-node user-node ${agentStatus.user === 'active' ? 'active-pulse' : ''}`}>
              <div className="node-icon" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <User size={18} />
              </div>
              <div className="node-info">
                <span className="node-title">Pengguna (User)</span>
                <span className="node-subtitle">Pemberi Instruksi & Pengambil Keputusan</span>
              </div>
              <span className={`node-status-tag ${agentStatus.user === 'active' ? 'tag-working' : 'tag-idle'}`}>
                {agentStatus.user === 'active' ? 'PROMPT' : 'READY'}
              </span>
            </div>
          </div>

          {/* Level 1: Supervisor */}
          <div className="tree-level-supervisor">
            <div className={`agent-node supervisor-node ${agentStatus.supervisor === 'running' ? 'active-pulse' : ''}`}>
              <div className="node-icon supervisor">
                <Brain size={20} />
              </div>
              <div className="node-info">
                <span className="node-title">Supervisor Agent</span>
                <span className="node-subtitle">Orkestrator, Delegasi Tugas & Sintesis Eksekutif</span>
              </div>
              <span className={`node-status-tag ${
                agentStatus.supervisor === 'running' ? 'tag-working' : (agentStatus.supervisor === 'done' ? 'tag-done' : 'tag-idle')
              }`}>
                {agentStatus.supervisor === 'running' ? 'PLANNING & DISPATCH' : (agentStatus.supervisor === 'done' ? 'SYNTHESIZED' : 'IDLE')}
              </span>
            </div>
          </div>

          {/* Level 2: Sub-Agents Grid */}
          <div className="tree-subagents-grid">
            {/* Email Agent */}
            <div className={`agent-node ${agentStatus.email === 'running' ? 'active-pulse' : ''}`}>
              <div className="node-icon email">
                <Mail size={18} />
              </div>
              <div className="node-info">
                <span className="node-title">Email Agent</span>
                <span className="node-subtitle">Audit Inbox & Urgent</span>
              </div>
              <span className={`node-status-tag ${
                agentStatus.email === 'running' ? 'tag-working' : (agentStatus.email === 'done' ? 'tag-done' : 'tag-idle')
              }`}>
                {agentStatus.email === 'running' ? 'FETCHING' : (agentStatus.email === 'done' ? 'AUDITED' : 'IDLE')}
              </span>
            </div>

            {/* Market Agent */}
            <div className={`agent-node ${agentStatus.market === 'running' ? 'active-pulse' : ''}`}>
              <div className="node-icon market">
                <TrendingUp size={18} />
              </div>
              <div className="node-info">
                <span className="node-title">Market Agent</span>
                <span className="node-subtitle">IHSG, Valas & Komoditas</span>
              </div>
              <span className={`node-status-tag ${
                agentStatus.market === 'running' ? 'tag-working' : (agentStatus.market === 'done' ? 'tag-done' : 'tag-idle')
              }`}>
                {agentStatus.market === 'running' ? 'QUERYING' : (agentStatus.market === 'done' ? 'LIVE' : 'IDLE')}
              </span>
            </div>

            {/* Weather Agent */}
            <div className={`agent-node ${agentStatus.weather === 'running' ? 'active-pulse' : ''}`}>
              <div className="node-icon weather">
                <CloudSun size={18} />
              </div>
              <div className="node-info">
                <span className="node-title">Weather Agent</span>
                <span className="node-subtitle">Atmosfer & Prakiraan</span>
              </div>
              <span className={`node-status-tag ${
                agentStatus.weather === 'running' ? 'tag-working' : (agentStatus.weather === 'done' ? 'tag-done' : 'tag-idle')
              }`}>
                {agentStatus.weather === 'running' ? 'RADAR' : (agentStatus.weather === 'done' ? 'MAPPED' : 'IDLE')}
              </span>
            </div>

            {/* Advisor Agent */}
            <div className={`agent-node ${agentStatus.advisor === 'running' ? 'active-pulse' : ''}`}>
              <div className="node-icon advisor">
                <Lightbulb size={18} />
              </div>
              <div className="node-info">
                <span className="node-title">Advisor Agent</span>
                <span className="node-subtitle">Saran Strategis Lintas-Domain</span>
              </div>
              <span className={`node-status-tag ${
                agentStatus.advisor === 'running' ? 'tag-working' : (agentStatus.advisor === 'done' ? 'tag-done' : 'tag-idle')
              }`}>
                {agentStatus.advisor === 'running' ? 'REASONING' : (agentStatus.advisor === 'done' ? 'READY' : 'IDLE')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Query Control Deck */}
      <section className="control-panel">
        <form
          className="query-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleExecute();
          }}
        >
          <div className="input-row">
            <textarea
              className="query-input"
              rows={2}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tanyakan instruksi atau mintalah briefing multi-agent..."
            />
            <select
              className="city-select"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              title="Pilih Kota Pemantauan Cuaca"
            >
              <option value="Jakarta">Jakarta</option>
              <option value="Surabaya">Surabaya</option>
              <option value="Bandung">Bandung</option>
              <option value="Semarang">Semarang</option>
              <option value="Medan">Medan</option>
              <option value="Makassar">Makassar</option>
              <option value="Bali">Denpasar / Bali</option>
              <option value="Yogyakarta">Yogyakarta</option>
              <option value="Singapore">Singapore</option>
              <option value="Tokyo">Tokyo</option>
            </select>
            <button className="btn-send" type="submit" disabled={loading}>
              <Send size={16} />
              <span>{loading ? 'Memproses...' : 'Kirim'}</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="presets-container">
            <span className="preset-label">Preset Cepat:</span>
            <button
              type="button"
              className="preset-chip"
              onClick={() => {
                const p = 'Cek kurs mata uang harian: Dolar AS, Yen Jepang, dan Dolar Australia terhadap Rupiah hari ini.';
                setQuery(p);
                handleExecute(p);
              }}
            >
              💱 Kurs Valas (USD, Yen, AUD)
            </button>

            <button
              type="button"
              className="preset-chip"
              onClick={() => {
                const p = 'Briefing pagi lengkap: cek email masuk, pasar finansial, cuaca hari ini, dan susun prioritas aksi harian.';
                setQuery(p);
                handleExecute(p);
              }}
            >
              🌅 Morning Briefing Lengkap
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => {
                const p = 'Analisis kondisi pasar finansial, pergerakan IHSG, kurs USD/IDR, harga emas dan bitcoin hari ini.';
                setQuery(p);
                handleExecute(p);
              }}
            >
              📈 Pasar Finansial & Kurs
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => {
                const p = 'Cek cuaca terkini di kota saya, peluang hujan, dan berikan saran pakaian serta waktu mobilitas terbaik.';
                setQuery(p);
                handleExecute(p);
              }}
            >
              ⛅ Cuaca & Mobilitas
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => {
                const p = 'Audit email masuk: temukan email yang memerlukan tindak lanjut segera atau memiliki deadline hari ini.';
                setQuery(p);
                handleExecute(p);
              }}
            >
              ✉️ Audit Email Urgent
            </button>
          </div>
        </form>
      </section>

      {/* Live Agent Activity Feed / Logs */}
      {logs.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} color="#06b6d4" />
              <span>Live Multi-Agent Activity Log ({logs.length} events)</span>
            </span>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer' }}
              onClick={() => setShowLogs(!showLogs)}
            >
              {showLogs ? 'Sembunyikan Terminal' : 'Tampilkan Terminal'}
            </button>
          </div>

          {showLogs && (
            <div className="logs-panel">
              {logs.map((lg, idx) => (
                <div key={idx} className="log-entry">
                  <span className="log-time">[{lg.timestamp}]</span>
                  <span className="log-agent">{lg.agent}</span>
                  <span className={`log-msg ${lg.status}`}>{lg.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </section>
      )}

      {/* Tabs Navigation */}
      <nav className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
          style={{
            background: activeTab === 'chat' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
            borderColor: activeTab === 'chat' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)'
          }}
        >
          <MessageSquare size={16} color="#818cf8" />
          <span style={{ fontWeight: 700, color: activeTab === 'chat' ? '#fff' : '#c7d2fe' }}>💬 Voice Chat (ElevenLabs)</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Brain size={16} />
          <span>Executive Briefing</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'advisor' ? 'active' : ''}`}
          onClick={() => setActiveTab('advisor')}
        >
          <Lightbulb size={16} />
          <span>Saran & Rekomendasi</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'market' ? 'active' : ''}`}
          onClick={() => setActiveTab('market')}
        >
          <TrendingUp size={16} />
          <span>Pasar & Valas ({result?.market_data?.items?.length || 0})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'weather' ? 'active' : ''}`}
          onClick={() => setActiveTab('weather')}
        >
          <CloudSun size={16} />
          <span>Cuaca ({result?.weather_data?.city || city})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          <Mail size={16} />
          <span>Kotak Masuk ({result?.email_data?.emails?.length || 0})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'sports' ? 'active' : ''}`}
          onClick={() => setActiveTab('sports')}
        >
          <span style={{ fontSize: '1rem' }}>⚽</span>
          <span>LiveScore Bola</span>
        </button>

      </nav>

      {/* Main Results View */}
      {result && (
        <main className="dashboard-grid">
                      {/* TAB 0: VOICE CHAT ELEVENLABS */}
            {activeTab === 'chat' && (
              <div style={{ width: '100%' }}>
                <VoiceChat
                  apiBase={API_BASE}
                  city={city}
                  settingsData={settingsData}
                  onOpenSettings={() => setShowSettings(true)}
                  onOpenMarket={() => setActiveTab('market')}
                />
              </div>
            )}

            {/* TAB 1: EXECUTIVE BRIEFING */}
          {activeTab === 'overview' && (
            <div>
              <ForexCard marketItems={result?.market_data?.items || []} onAskCurrency={(text) => { setActiveTab('chat'); }} />

                <div className="synthesis-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <h2 className="synthesis-title" style={{ margin: 0 }}>
                    <Brain size={20} color="#6366f1" />
                    <span>Executive Briefing Terpadu (Supervisor AI)</span>
                  </h2>

                  {/* ElevenLabs TTS Voice Button */}
                  <button
                    onClick={playVoiceBriefing}
                    disabled={voiceLoading}
                    className="btn-header"
                    style={{
                      background: isPlayingVoice ? 'rgba(244, 63, 94, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                      borderColor: isPlayingVoice ? 'var(--rose)' : 'var(--primary)',
                      color: isPlayingVoice ? '#fb7185' : '#a5b4fc',
                      padding: '8px 16px',
                      borderRadius: '8px'
                    }}
                  >
                    {voiceLoading ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : isPlayingVoice ? (
                      <Square size={15} />
                    ) : (
                      <Volume2 size={15} />
                    )}
                    <span>
                      {voiceLoading
                        ? 'Membuat Suara...'
                        : isPlayingVoice
                        ? 'Hentikan Audio'
                        : 'Dengarkan Suara (ElevenLabs)'}
                    </span>
                  </button>
                </div>

                <div className="synthesis-body">
                  {result.final_synthesis}
                </div>
              </div>

              {/* Quick Glance Matrix */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '20px' }}>
                {/* Weather Glance */}
                {result.weather_data && (
                  <div className="advisor-box mobility" onClick={() => setActiveTab('weather')} style={{ cursor: 'pointer' }}>
                    <div className="advisor-box-title">
                      <CloudSun size={16} />
                      <span>Cuaca: {result.weather_data.city}</span>
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                      {result.weather_data.temperature}°C
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {result.weather_data.condition} • Peluang Hujan {result.weather_data.precipitation_prob}%
                    </p>
                  </div>
                )}

                {/* Market Glance */}
                {result.market_data && (
                  <div className="advisor-box financial" onClick={() => setActiveTab('market')} style={{ cursor: 'pointer' }}>
                    <div className="advisor-box-title">
                      <TrendingUp size={16} />
                      <span>Sentimen Pasar</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                      {result.market_data.market_sentiment}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Memantau {result.market_data.items.length} instrumen saham, valas & komoditas
                    </p>
                  </div>
                )}

                {/* Email Glance */}
                {result.email_data && (
                  <div className="advisor-box priority" onClick={() => setActiveTab('email')} style={{ cursor: 'pointer' }}>
                    <div className="advisor-box-title">
                      <Mail size={16} />
                      <span>Kotak Masuk</span>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fb7185' }}>
                      {result.email_data.urgent_count} Urgent / {result.email_data.total_emails} Total
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {result.email_data.urgent_count > 0 ? 'Terdapat email yang butuh respons cepat' : 'Seluruh inbox terkendali'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STRATEGIC ADVISOR */}
          {activeTab === 'advisor' && result.advisor_data && (
            <div>
              <ForexCard marketItems={result?.market_data?.items || []} onAskCurrency={(text) => { setActiveTab('chat'); }} />

                <div className="synthesis-card">
                <h2 className="synthesis-title">
                  <Lightbulb size={20} color="#f59e0b" />
                  <span>Saran Strategis Lintas-Domain (Strategic Advisor Agent)</span>
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                  {result.advisor_data.executive_summary}
                </p>

                <div className="advisor-cards-grid">
                  <div className="advisor-box priority">
                    <h3 className="advisor-box-title">
                      <AlertTriangle size={16} />
                      <span>Tindakan Prioritas Utama</span>
                    </h3>
                    <ul className="advisor-list">
                      {result.advisor_data.priority_actions.map((act, i) => (
                        <li key={i} className="advisor-item">
                          <span className="advisor-bullet">▸</span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="advisor-box financial">
                    <h3 className="advisor-box-title">
                      <DollarSign size={16} />
                      <span>Finansial & Investasi</span>
                    </h3>
                    <ul className="advisor-list">
                      {result.advisor_data.financial_tips.map((tip, i) => (
                        <li key={i} className="advisor-item">
                          <span className="advisor-bullet">▸</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="advisor-box mobility">
                    <h3 className="advisor-box-title">
                      <Wind size={16} />
                      <span>Mobilitas & Kesehatan</span>
                    </h3>
                    <ul className="advisor-list">
                      {result.advisor_data.mobility_health_tips.map((mob, i) => (
                        <li key={i} className="advisor-item">
                          <span className="advisor-bullet">▸</span>
                          <span>{mob}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MARKET AGENT */}
          {activeTab === 'market' && result.market_data && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Pasar Finansial Terkini</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{result.market_data.summary}</p>
                </div>
                <div className="status-badge" style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'var(--border-active)', color: '#a5b4fc' }}>
                  <span>Sentimen: {result.market_data.market_sentiment}</span>
                </div>
              </div>

              <ForexCard marketItems={result?.market_data?.items || []} onAskCurrency={(text) => { setActiveTab('chat'); }} />

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: '14px', marginTop: '20px' }}>Indeks Saham, Emas & Aset Digital Lainnya</h3>
                <div className="market-cards-grid">
                {result.market_data.items.map((item, idx) => (
                  <div key={idx} className="ticker-card">
                    <div className="ticker-header">
                      <div>
                        <div className="ticker-name">{item.name}</div>
                        <div className="ticker-sym">{item.symbol}</div>
                      </div>
                      <span className={`trend-badge trend-${item.trend}`}>
                        {item.trend === 'up' && <ArrowUpRight size={14} />}
                        {item.trend === 'down' && <ArrowDownRight size={14} />}
                        <span>{item.change_percent >= 0 ? `+${item.change_percent}%` : `${item.change_percent}%`}</span>
                      </span>
                    </div>

                    <div>
                      <div className="ticker-price">
                        {item.currency === 'IDR' ? `Rp ${item.price.toLocaleString('id-ID')}` : `$${item.price.toLocaleString('en-US')}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: item.change >= 0 ? '#34d399' : '#fb7185' }}>
                        Selisih: {item.change >= 0 ? `+${item.change}` : item.change} {item.currency}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: WEATHER AGENT */}
          {activeTab === 'weather' && result.weather_data && (
            <div>
              <div className="weather-hero">
                <div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Kondisi Cuaca Real-Time
                  </div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                    {result.weather_data.city}
                  </h2>
                  <div className="weather-main">
                    <div className="weather-temp-huge">
                      {result.weather_data.temperature}°C
                    </div>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>
                        {result.weather_data.condition}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '320px', marginTop: '4px' }}>
                        {result.weather_data.advisory}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="weather-details-grid">
                  <div className="weather-detail-item">
                    <span className="weather-detail-label">Kelembaban Udara</span>
                    <span className="weather-detail-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Droplets size={16} color="#38bdf8" />
                      <span>{result.weather_data.humidity}%</span>
                    </span>
                  </div>
                  <div className="weather-detail-item">
                    <span className="weather-detail-label">Peluang Hujan</span>
                    <span className="weather-detail-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CloudSun size={16} color="#818cf8" />
                      <span>{result.weather_data.precipitation_prob}%</span>
                    </span>
                  </div>
                  <div className="weather-detail-item">
                    <span className="weather-detail-label">Kecepatan Angin</span>
                    <span className="weather-detail-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Wind size={16} color="#34d399" />
                      <span>{result.weather_data.wind_speed_kmh} km/jam</span>
                    </span>
                  </div>
                  <div className="weather-detail-item">
                    <span className="weather-detail-label">Indeks UV</span>
                    <span className="weather-detail-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sun size={16} color="#fbbf24" />
                      <span>{result.weather_data.uv_index}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Forecast Days */}
              {result.weather_data.forecast?.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Prakiraan Beberapa Hari ke Depan
                  </h3>
                  <div className="weather-forecast-row">
                    {result.weather_data.forecast.map((f, i) => (
                      <div key={i} className="forecast-day-card">
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px' }}>{f.date}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{f.temp_max}°C</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>min {f.temp_min}°C</div>
                        <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '6px' }}>{f.condition}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

                      {/* TAB 6: SPORTS & LIVESCORE */}
            {activeTab === 'sports' && (
              <div>
                <SportsCard apiBase={API_BASE} onAskSports={(text) => { setActiveTab('chat'); }} />
              </div>
            )}

            {/* TAB 5: EMAIL AGENT */}
          {activeTab === 'email' && result.email_data && (
            <div>
              {/* Connection Status Banner */}
              <div style={{
                background: emailConn.connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.12)',
                border: `1px solid ${emailConn.connected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem', color: emailConn.connected ? '#34d399' : '#fff' }}>
                    <ShieldCheck size={18} color={emailConn.connected ? '#34d399' : '#818cf8'} />
                    <span>{emailConn.connected ? `Terhubung: ${emailConn.label}` : 'Integrasikan Email Pribadi Anda'}</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {emailConn.connected
                      ? 'Email Agent kini membaca kotak masuk Gmail pribadi Anda secara real-time.'
                      : 'Hubungkan Gmail Anda agar agen dapat memindai email pekerjaan & mendeteksi pesan urgent nyata.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {emailConn.connected ? (
                    <button
                      onClick={handleEmailDisconnect}
                      className="btn-header"
                      style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                    >
                      Putus Koneksi
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleGoogleConnect}
                        disabled={oauthLoading}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        <Mail size={15} />
                        <span>{oauthLoading ? 'Menghubungkan...' : 'Login Google (1-Klik)'}</span>
                      </button>
                      <button
                        onClick={() => setShowSettings(true)}
                        className="btn-header"
                        style={{ fontSize: '0.85rem' }}
                      >
                        Atur IMAP
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>Kotak Masuk Terintegrasi</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {result.email_data.summary} (Sumber: {result.email_data.source === 'real_gmail_oauth' ? 'Gmail API OAuth Live' : (result.email_data.source === 'real_imap' ? 'Gmail IMAP Live' : 'Simulasi Cerdas')})
                  </p>
                </div>
                <div className="status-badge" style={{ background: 'rgba(244,63,94,0.15)', borderColor: 'rgba(244,63,94,0.3)', color: '#fb7185' }}>
                  <span>{result.email_data.urgent_count} Butuh Tindakan</span>
                </div>
              </div>

              <div className="email-list">
                {result.email_data.emails.map((em) => (
                  <div key={em.id} className={`email-card ${em.is_urgent ? 'urgent-border' : ''}`}>
                    <div className="email-header">
                      <span className="email-sender">{em.sender}</span>
                      <span className="email-date">{em.date}</span>
                    </div>

                    <div className="email-subject">
                      {em.is_urgent && <span className="badge-urgent">URGENT</span>}
                      <span>{em.subject}</span>
                    </div>

                    <p className="email-snippet">{em.snippet}</p>

                    {em.suggested_action && (
                      <div className="email-action-box">
                        <strong style={{ color: '#fff' }}>Rekomendasi Tindakan: </strong>
                        {em.suggested_action}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Pengaturan & Kredensial</h2>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Google Gemini API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="Masukkan API Key Gemini..."
                value={settingsData.gemini_api_key}
                onChange={(e) => setSettingsData({ ...settingsData, gemini_api_key: e.target.value })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                Model aktif: <code>gemini-2.0-flash</code>.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">ElevenLabs API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="sk_..."
                value={settingsData.elevenlabs_api_key}
                onChange={(e) => setSettingsData({ ...settingsData, elevenlabs_api_key: e.target.value })}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                Gunakan secret key ElevenLabs (dimulai dengan <code>sk_...</code>). Jika menggunakan Key ID atau kosong, sistem otomatis memakai Web Speech TTS bahasa Indonesia.
              </span>
            </div>

            <div className="form-group" style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <label className="form-label" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={15} color="#818cf8" />
                <span>Opsi 1: Google OAuth (Gmail API - 1-Klik)</span>
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: emailConn.connected ? '#34d399' : 'var(--text-muted)' }}>
                  Status: <strong>{emailConn.label}</strong>
                </span>
                {emailConn.connected ? (
                  <button onClick={handleEmailDisconnect} className="btn-header" style={{ color: '#fb7185' }}>
                    Putus
                  </button>
                ) : (
                  <button onClick={handleGoogleConnect} disabled={oauthLoading} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                    {oauthLoading ? 'Menghubungkan...' : 'Login Google'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'center', margin: '14px 0 10px', fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
              — ATAU OPSI 2: GMAIL / IMAP APP PASSWORD (DIREKOMENDASIKAN) —
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">Email Akun (Gmail / IMAP)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="contoh: user@gmail.com"
                  value={settingsData.email_user}
                  onChange={(e) => setSettingsData({ ...settingsData, email_user: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Google App Password (16 Karakter)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={settingsData.email_password}
                  onChange={(e) => setSettingsData({ ...settingsData, email_password: e.target.value })}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '6px', lineHeight: 1.4 }}>
                  💡 <strong>Cara dapatkan Google App Password (1 Menit):</strong><br />
                  1. Buka <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>myaccount.google.com/apppasswords</a>.<br />
                  2. Masukkan nama aplikasi (misal: <em>Personal Assistant</em>), klik Buat.<br />
                  3. Salin 16 karakter sandi yang muncul ke kolom di atas.
                </div>
              </div>

              {imapFeedback && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  fontSize: '0.8rem',
                  background: imapFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${imapFeedback.type === 'success' ? '#10b981' : '#ef4444'}`,
                  color: imapFeedback.type === 'success' ? '#34d399' : '#f87171'
                }}>
                  {imapFeedback.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {emailConn.connected && emailConn.type === 'imap' && (
                  <button onClick={handleEmailDisconnect} className="btn-header" style={{ color: '#fb7185', fontSize: '0.8rem', padding: '6px 12px' }}>
                    Putus IMAP
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleImapConnect}
                  disabled={imapLoading}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem', padding: '7px 16px' }}
                >
                  {imapLoading ? 'Menguji & Menghubungkan...' : '⚡ Uji & Hubungkan IMAP Sekarang'}
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowSettings(false)}>
                Tutup
              </button>
              <button className="btn-primary" onClick={saveSettings}>
                Simpan Semua Konfigurasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
