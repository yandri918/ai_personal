import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Bot,
  User,
  RefreshCw,
  Sliders,
  DollarSign,
  CloudSun,
  Mail,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export default function VoiceChat({
  apiBase = 'http://localhost:8000',
  city = 'Jakarta',
  settingsData = {},
  onOpenSettings,
  onOpenMarket
}) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: 'Halo! Saya Aura, asisten pribadi pintar Anda didukung Google Gemini dan suara ElevenLabs. Anda bisa menanyakan kurs valas harian (Yen, Dolar Australia, Dolar AS), kondisi cuaca, prioritas email, atau rencana kerja Anda.',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoPlayVoice, setAutoPlayVoice] = useState(true);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(settingsData.elevenlabs_voice_id || '21m00Tcm4TlvDq8ikWAM');
  const [playingMsgId, setPlayingMsgId] = useState(null);
  const [voiceNotice, setVoiceNotice] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Fetch available ElevenLabs voices on mount
  useEffect(() => {
    fetchVoices();
    setupSpeechRecognition();

    return () => {
      stopAudio();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const fetchVoices = async () => {
    try {
      const res = await fetch(`${apiBase}/api/voices`);
      if (res.ok) {
        const data = await res.json();
        setVoices(data);
      }
    } catch {
      // Fallback preset
      setVoices([
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', label: 'Rachel (Female - Hangat & Elegan)' },
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', label: 'Adam (Male - Tegas & Berkarakter)' },
        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', label: 'Bella (Female - Lembut & Ramah)' },
        { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', label: 'Antoni (Male - Enerjik & Jelas)' },
        { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Ellie', label: 'Ellie (Female - Ceria & Santai)' },
        { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', label: 'Liam (Male - Modern & Artikulatif)' }
      ]);
    }
  };

  const setupSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = 'id-ID';

      recog.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsRecording(false);
      };

      recog.onerror = () => {
        setIsRecording(false);
      };

      recog.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recog;
    }
  };

  const toggleMicRecording = () => {
    if (!recognitionRef.current) {
      alert('Browser Anda tidak mendukung Web Speech Recognition. Gunakan Google Chrome atau Edge.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.warn('Speech recognition start failed:', err);
      }
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingMsgId(null);
  };

  const playVoiceForMessage = async (msgId, text) => {
    if (playingMsgId === msgId) {
      stopAudio();
      return;
    }

    stopAudio();
    setPlayingMsgId(msgId);

    // Clean text from symbols
    const cleanSpeech = text
      .replace(/[#*`_\[\]()>-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      // 1. Try ElevenLabs API endpoint
      const res = await fetch(`${apiBase}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanSpeech,
          voice_id: selectedVoice
        })
      });

      if (res.ok) {
        setVoiceNotice(null);
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setPlayingMsgId(null);
          audioRef.current = null;
        };

        audio.onerror = () => {
          playBrowserVoice(cleanSpeech, msgId);
        };

        await audio.play();
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errDetail = errorData.detail || 'Gagal memuat suara ElevenLabs';
        setVoiceNotice(`Info Audio: ${errDetail} (Mengalihkan ke suara lokal browser).`);
        playBrowserVoice(cleanSpeech, msgId);
      }
    } catch {
      setVoiceNotice('Mengalihkan ke sintesis suara browser bahasa Indonesia.');
      playBrowserVoice(cleanSpeech, msgId);
    }
  };

  const playBrowserVoice = (text, msgId) => {
    if (!('speechSynthesis' in window)) {
      setPlayingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.includes('id') || v.lang.includes('ID'));
    if (idVoice) utterance.voice = idVoice;

    utterance.onstart = () => {
      setPlayingMsgId(msgId);
    };
    utterance.onend = () => {
      setPlayingMsgId(null);
    };
    utterance.onerror = () => {
      setPlayingMsgId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    stopAudio();

    const newMsgId = Date.now();
    const userMsg = {
      id: newMsgId,
      role: 'user',
      text: query,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputText('');
    setLoading(true);

    try {
      // Map history for API
      const historyPayload = updatedHistory.slice(1, -1).map((m) => ({
        role: m.role,
        content: m.text
      }));

      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          chat_history: historyPayload,
          city: city,
          context_aware: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsgId = Date.now() + 1;
        const assistantMsg = {
          id: assistantMsgId,
          role: 'assistant',
          text: data.reply || 'Maaf, tidak ada jawaban dari asisten.',
          contextUsed: data.context_used,
          time: data.timestamp || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Auto-play voice if enabled
        if (autoPlayVoice && data.reply) {
          playVoiceForMessage(assistantMsgId, data.reply);
        }
      } else {
        const errorMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          text: 'Terjadi kendala saat menghubungi server asisten AI. Silakan coba sesaat lagi.',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: `Koneksi terputus: ${err.message}`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    {
      icon: <DollarSign size={13} color="#34d399" />,
      text: 'Berapa kurs Dolar AS, Yen Jepang, dan Dolar Australia hari ini?'
    },
    {
      icon: <CloudSun size={13} color="#38bdf8" />,
      text: `Bagaimana prakiraan cuaca di ${city} hari ini?`
    },
    {
      icon: <TrendingUp size={13} color="#fbbf24" />,
      text: 'Analisis ringkas sentimen pasar finansial hari ini'
    },
    {
      icon: <Mail size={13} color="#f472b6" />,
      text: 'Cek prioritas email penting dan tindakan yang disarankan'
    }
  ];

  return (
    <div className="chat-wrapper">
      {/* Voice Control Header Bar */}
      <div className="chat-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="chat-avatar assistant" style={{ width: '32px', height: '32px' }}>
            <Bot size={17} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff' }}>Aura Voice Assistant</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              Didukung ElevenLabs TTS & Gemini 3.8 Flash
            </div>
          </div>
        </div>

        <div className="chat-voice-tools">
          {/* Voice Selector */}
          <select
            className="voice-select-dropdown"
            value={selectedVoice}
            onChange={(e) => {
              setSelectedVoice(e.target.value);
              stopAudio();
            }}
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                🎙️ {v.label || v.name}
              </option>
            ))}
          </select>

          {/* Auto-TTS Toggle */}
          <label className="auto-tts-toggle">
            <input
              type="checkbox"
              checked={autoPlayVoice}
              onChange={(e) => setAutoPlayVoice(e.target.checked)}
              style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <span>{autoPlayVoice ? '🔊 Suara Otomatis' : '🔇 Suara Manual'}</span>
          </label>

          {playingMsgId && (
            <button
              onClick={stopAudio}
              className="btn-tts-listen playing"
              style={{ padding: '5px 12px' }}
            >
              <Square size={12} />
              <span>Hentikan Suara</span>
            </button>
          )}
        </div>
      </div>

      {/* Voice Notification Banner */}
      {voiceNotice && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '8px 20px',
            fontSize: '0.78rem',
            color: '#fbbf24',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} />
            <span>{voiceNotice}</span>
          </div>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: '0.78rem',
                textDecoration: 'underline'
              }}
            >
              Atur ElevenLabs Key
            </button>
          )}
        </div>
      )}

      {/* Messages Thread */}
      <div className="chat-messages-container">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isPlaying = playingMsgId === msg.id;

          return (
            <div key={msg.id} className={`chat-message-row ${msg.role}`}>
              <div className={`chat-avatar ${msg.role}`}>
                {isUser ? <User size={18} /> : <Bot size={18} />}
              </div>

              <div className="chat-bubble-content">
                <div className="chat-bubble">
                  {msg.text}
                </div>

                <div className="chat-bubble-footer">
                  <span>{msg.time}</span>

                  {!isUser && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => playVoiceForMessage(msg.id, msg.text)}
                        className={`btn-tts-listen ${isPlaying ? 'playing' : ''}`}
                      >
                        {isPlaying ? (
                          <>
                            <Square size={11} />
                            <span>Stop</span>
                            <div className="sound-wave-bars">
                              <span className="sound-wave-bar"></span>
                              <span className="sound-wave-bar"></span>
                              <span className="sound-wave-bar"></span>
                              <span className="sound-wave-bar"></span>
                            </div>
                          </>
                        ) : (
                          <>
                            <Volume2 size={12} />
                            <span>Dengarkan Suara</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="chat-message-row assistant">
            <div className="chat-avatar assistant">
              <Bot size={18} />
            </div>
            <div className="chat-bubble-content">
              <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)' }}>
                <RefreshCw size={15} className="animate-spin" />
                <span>Aura sedang berpikir & merangkum data...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="chat-quick-chips">
        {quickPrompts.map((chip, idx) => (
          <button
            key={idx}
            className="chat-quick-chip"
            onClick={() => handleSendMessage(chip.text)}
            disabled={loading}
          >
            {chip.icon}
            <span>{chip.text}</span>
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <div className="chat-input-bar">
        <button
          onClick={toggleMicRecording}
          className={`btn-mic-record ${isRecording ? 'recording' : ''}`}
          title={isRecording ? 'Sedang merekam suara... Klik untuk berhenti' : 'Bicara dengan Mikrofon'}
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <input
          type="text"
          className="chat-text-input"
          placeholder={isRecording ? 'Mendengarkan ucapan Anda...' : 'Ketik pertanyaan (kurs mata uang, cuaca, agenda)...'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          disabled={loading}
        />

        <button
          className="btn-chat-send"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim() || loading}
        >
          {loading ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
          <span>Kirim</span>
        </button>
      </div>
    </div>
  );
}
