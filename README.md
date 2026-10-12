# 🤖 AURA — AI Personal Assistant (Multi-Agent System)

Platform Asisten Pribadi Cerdas berbasis **Hierarchical Multi-Agent Architecture** terintegrasi dengan Google Gemini 3.8 Flash, ElevenLabs Multilingual Text-to-Speech, LiveScore Sepak Bola, dan Pemantau Kurs Valas Real-time.

---

## 🌟 Fitur Utama

- **🧠 Level 1: Supervisor Agent**: Mengorkestrasi tugas, merencanakan delegasi, dan menyusun *Executive Briefing* harian.
- **🎙️ Voice Chat (ElevenLabs)**: Percakapan dua arah dengan suara alami ElevenLabs (`eleven_multilingual_v2`), tombol kontrol suara, dan input mikrofon (*Speech-to-Text*).
- **💱 Kurs Valas Harian (Forex)**: Memantau nilai tukar real-time:
  - 🇺🇸 **Dolar Amerika Serikat (USD / IDR)**
  - 🇯🇵 **Yen Jepang (JPY / IDR)**
  - 🇦🇺 **Dolar Australia (AUD / IDR)**
- **⚽ LiveScore & Sepak Bola**: Menampilkan skor langsung, jadwal pertandingan, dan hasil liga-liga top dunia (Premier League, Champions League, La Liga, Serie A, Timnas) via DuckDuckGo & LiveScore.com.
- **🌦️ Weather Agent**: Prakiraan cuaca akurat, kelembapan, kecepatan angin, dan saran indeks UV.
- **📧 Email Agent**: Manajemen audit kotak masuk email penting & darurat (Gmail OAuth / IMAP).

---

## 🚀 Deployment ke Railway

Proyek ini telah dikonfigurasi untuk deployment 1-klik di **[Railway](https://railway.com/)**:

1. Fork atau gunakan repositori ini: `https://github.com/yandri918/ai_personal.git`
2. Di Dashboard Railway:
   - Klik **New Project** → **Deploy from GitHub repo**.
   - Pilih `ai_personal`.
3. Tambahkan **Variables** di Railway:
   - `GEMINI_API_KEY`: Kunci API Google AI Studio Anda.
   - `GEMINI_MODEL`: `gemini-3.8-flash`
   - `ELEVENLABS_API_KEY`: Kunci API ElevenLabs Anda (diawali `sk_...`).
   - `ELEVENLABS_VOICE_ID`: `21m00Tcm4TlvDq8ikWAM` (atau suara pilihan Anda).
   - `DEFAULT_CITY`: `Jakarta`
4. Railway otomatis membaca `Dockerfile`, mem-build frontend React, dan menjalankan backend FastAPI pada port `$PORT`.

---

## 💻 Menjalankan Secara Lokal

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Aktifkan virtual environment
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate   # Windows

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (React 19 + Vite)
```bash
cd frontend
npm install
npm run dev
```
Buka browser di `http://localhost:5173`.
