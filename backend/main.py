import asyncio
import json
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import httpx
import re

from config import settings
from models import (
    QueryRequest,
    AssistantResponse,
    AgentLog,
    ChatRequest,
    ChatResponse,
    ChatMessage
)
from agents.supervisor_agent import SupervisorAgent
from agents.email_agent import EmailAgent
from agents.market_agent import MarketAgent
from agents.weather_agent import WeatherAgent
from agents.advisor_agent import AdvisorAgent
from agents.sports_agent import SportsAgent

app = FastAPI(
    title="Personal Assistant Multi-Agent API",
    description="Hierarchical Multi-Agent Architecture (User -> Supervisor Agent -> Sub-Agents)",
    version="1.2.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supervisor = SupervisorAgent()
email_agent = EmailAgent()
market_agent = MarketAgent()
weather_agent = WeatherAgent()
advisor_agent = AdvisorAgent()
sports_agent = SportsAgent()

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "hierarchy": {
            "level_0": "User",
            "level_1": "Supervisor Agent (Orchestrator & Synthesizer)",
            "level_2_subagents": [
                {"name": "Email Agent", "status": "active"},
                {"name": "Market Agent (Kurs USD/JPY/AUD)", "status": "active"},
                {"name": "Weather Agent", "status": "active"},
                {"name": "Sports & LiveScore Agent (DuckDuckGo)", "status": "active"},
                {"name": "Strategic Advisor Agent", "status": "active"}
            ]
        },
        "gemini_active": supervisor.gemini_ready,
        "gemini_model": settings.GEMINI_MODEL,
        "elevenlabs_active": bool(settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_API_KEY.startswith("sk_")),
        "default_city": settings.DEFAULT_CITY
    }

@app.post("/api/agent/execute", response_model=AssistantResponse)
async def execute_agent_pipeline(req: QueryRequest):
    try:
        response = await supervisor.execute(req)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

@app.post("/api/agent/stream")
async def stream_agent_pipeline(req: QueryRequest):
    """
    Server-Sent Events (SSE) streaming endpoint:
    Streams live agent logs and final result as they happen.
    """
    async def event_generator():
        queue = asyncio.Queue()

        async def stream_log_callback(entry: AgentLog):
            await queue.put({"type": "log", "data": entry.model_dump()})

        async def run_pipeline():
            try:
                res = await supervisor.execute(req, log_cb=stream_log_callback)
                await queue.put({"type": "result", "data": res.model_dump()})
            except Exception as e:
                await queue.put({"type": "error", "message": str(e)})
            finally:
                await queue.put(None)

        task = asyncio.create_task(run_pipeline())

        while True:
            msg = await queue.get()
            if msg is None:
                break
            payload = json.dumps(msg)
            yield f"data: {payload}\n\n"

        await task

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# ---------------------------------------------------------------------------
# Conversational Voice Chat Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/chat", response_model=ChatResponse)
async def chat_interaction(req: ChatRequest):
    """
    Interactive conversational endpoint designed for Voice Chat (ElevenLabs).
    Uses Gemini with memory and smart context injection (weather, forex, sports).
    """
    user_query = req.message.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Pesan percakapan tidak boleh kosong.")

    context_hint = ""
    q_lower = user_query.lower()
    if req.context_aware:
        context_parts = []
        if any(w in q_lower for w in ["cuaca", "hujan", "suhu", "panas", "weather", "mendung", "payung"]):
            try:
                w_data = await weather_agent.execute(city=req.city or settings.DEFAULT_CITY)
                context_parts.append(
                    f"Informasi Cuaca {w_data.city}: Suhu {w_data.temperature}°C, Kondisi: {w_data.condition}, "
                    f"Kelembapan: {w_data.humidity}%, UV: {w_data.uv_index}. Saran: {w_data.advisory}"
                )
            except Exception:
                pass

        if any(w in q_lower for w in ["pasar", "saham", "ihsg", "kurs", "rupiah", "dollar", "usd", "emas", "btc", "crypto", "market", "keuangan", "yen", "jpy", "australia", "aud", "valas", "forex", "mata uang"]):
            try:
                m_data = await market_agent.execute()
                takeaways = "; ".join(m_data.key_takeaways[:5])
                context_parts.append(f"Kondisi Pasar & Kurs Valas Real-time: Sentimen {m_data.market_sentiment}. Ringkasan: {takeaways}")
            except Exception:
                pass

        if any(w in q_lower for w in ["bola", "sepak bola", "livescore", "skor", "pertandingan", "liga", "champions", "premier", "madrid", "barcelona", "arsenal", "liverpool", "juventus", "timnas"]):
            try:
                s_data = await sports_agent.execute()
                m_list = [f"{m.home_team} {m.score} {m.away_team} ({m.league}, status: {m.status})" for m in s_data.matches[:5]]
                context_parts.append(
                    f"Informasi LiveScore Sepak Bola Terkini: {s_data.summary}. "
                    f"Rincian Pertandingan: {'; '.join(m_list)}. "
                    f"Sumber Data: LiveScore.com via DuckDuckGo."
                )
            except Exception:
                pass

        if context_parts:
            context_hint = "\n[DATA REAL-TIME SUB-AGENT]:\n" + "\n".join(context_parts)

    system_instruction = (
        "Anda adalah Aura / AgriSensa AI Personal Assistant — asisten eksekutif pribadi yang cerdas, hangat, dan solutif. "
        "Gunakan Bahasa Indonesia yang alami, luwes, dan bersahabat. "
        "PENTING: Tanggapan Anda akan dibacakan langsung menggunakan suara ElevenLabs Text-to-Speech! "
        "Oleh karena itu, berikan respon yang ringkas, mudah dipahami ketika didengar (conversational), "
        "dan jangan gunakan tabel atau simbol markdown yang berlebihan. "
        "Jika ada data angka kurs, cuaca, atau skor pertandingan LiveScore, sebutkan intisarinya dengan ramah dan jelas."
    )

    history_text = ""
    if req.chat_history:
        for msg in req.chat_history[-6:]:
            role_label = "Pengguna" if msg.role == "user" else "Aura"
            history_text += f"{role_label}: {msg.content}\n"

    full_prompt = (
        f"{system_instruction}\n\n"
        f"{context_hint}\n\n"
        f"Riwayat Percakapan Sebelumnya:\n{history_text}\n"
        f"Pengguna: {user_query}\n"
        f"Aura:"
    )

    reply_text = ""
    if supervisor.gemini_ready and supervisor.client:
        try:
            loop = asyncio.get_event_loop()
            res = await loop.run_in_executor(
                None,
                lambda: supervisor.client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=full_prompt
                )
            )
            reply_text = res.text.strip() if res and res.text else ""
        except Exception as e:
            reply_text = f"Terjadi kendala saat memproses jawaban AI: {str(e)}"

    if not reply_text:
        reply_text = f"Halo! Saya mendengar Anda menanyakan: '{user_query}'. Silakan tanyakan hal terkait cuaca di {req.city}, kurs valas (USD, Yen, AUD), skor sepak bola LiveScore, atau rencana aktivitas harian Anda."

    return ChatResponse(
        reply=reply_text,
        context_used="subagents_context" if context_hint else None
    )

# ---------------------------------------------------------------------------
# ElevenLabs Voice Presets & TTS
# ---------------------------------------------------------------------------
@app.get("/api/voices")
async def get_available_voices():
    """Daftar pilihan suara ElevenLabs yang optimal untuk bahasa Indonesia dan Inggris."""
    return [
        {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "label": "Rachel (Female - Hangat & Elegan)", "gender": "female", "desc": "Suara narator profesional wanita"},
        {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam", "label": "Adam (Male - Tegas & Berkarakter)", "gender": "male", "desc": "Suara eksekutif pria berwibawa"},
        {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella", "label": "Bella (Female - Lembut & Ramah)", "gender": "female", "desc": "Suara asisten personal natural"},
        {"id": "ErXwobaYiN019PkySvjV", "name": "Antoni", "label": "Antoni (Male - Enerjik & Jelas)", "gender": "male", "desc": "Suara presenter pria dinamis"},
        {"id": "MF3mGyEYCl7XYWbV9V6O", "name": "Ellie", "label": "Ellie (Female - Ceria & Santai)", "gender": "female", "desc": "Suara ramah percakapan santai"},
        {"id": "TX3LPaxmHKxFdv7VOQHJ", "name": "Liam", "label": "Liam (Male - Modern & Artikulatif)", "gender": "male", "desc": "Suara asisten modern"}
    ]

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None

@app.post("/api/tts")
async def generate_speech(payload: TTSRequest):
    """
    Generate speech using ElevenLabs API or return fallback signal.
    """
    api_key = settings.ELEVENLABS_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="ElevenLabs API key belum diisi. Masukkan API Key pada menu Pengaturan."
        )

    if not api_key.startswith("sk_"):
        raise HTTPException(
            status_code=400,
            detail="API Key ElevenLabs tidak valid (harus dimulai dengan 'sk_...'). Jika Anda menggunakan Key ID, silakan salin Secret Key yang diawali 'sk_' dari dashboard ElevenLabs."
        )

    voice_id = payload.voice_id or settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"
    
    # Strip markdown symbols for natural speech
    clean_text = re.sub(r'[#*_`\[\]()>-]', ' ', payload.text)
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
    clean_text = clean_text[:1500]

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }
    body = {
        "text": clean_text,
        "model_id": settings.ELEVENLABS_MODEL_ID,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"ElevenLabs error: {resp.text}")
            
            return StreamingResponse(
                resp.aiter_bytes(),
                media_type="audio/mpeg",
                headers={"Content-Disposition": "inline; filename=speech.mp3"}
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate TTS: {str(e)}")

# ---------------------------------------------------------------------------
# Sub-agent direct endpoints
# ---------------------------------------------------------------------------
@app.get("/api/agent/sports")
async def get_sports_scores():
    """Endpoint LiveScore & skor sepak bola terkini via DuckDuckGo."""
    return await sports_agent.execute()

@app.get("/api/agent/weather")
async def get_weather(city: str = Query("Jakarta")):
    return await weather_agent.execute(city=city)

@app.get("/api/agent/market")
async def get_market(symbols: Optional[str] = Query(None)):
    sym_list = symbols.split(",") if symbols else None
    return await market_agent.execute(symbols=sym_list)

@app.get("/api/agent/email")
async def get_email():
    return await email_agent.execute()

@app.get("/api/auth/google/status")
async def get_google_auth_status():
    return email_agent.get_connection_info()

@app.post("/api/auth/google/login")
async def start_google_login():
    """Start local browser OAuth login for Gmail."""
    try:
        loop = asyncio.get_event_loop()
        success = await loop.run_in_executor(None, email_agent.start_oauth_flow)
        return {"status": "authenticated", "success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class IMAPConnectRequest(BaseModel):
    email_user: str
    email_password: str
    imap_server: Optional[str] = "imap.gmail.com"
    imap_port: Optional[int] = 993

@app.post("/api/auth/imap/connect")
async def connect_imap(payload: IMAPConnectRequest):
    """Test IMAP credentials and connect personal email inbox."""
    loop = asyncio.get_event_loop()
    success, msg = await loop.run_in_executor(
        None,
        email_agent.test_and_save_imap,
        payload.email_user,
        payload.email_password,
        payload.imap_server or "imap.gmail.com",
        payload.imap_port or 993
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {
        "status": "authenticated",
        "message": msg,
        "connection_info": email_agent.get_connection_info()
    }

@app.post("/api/auth/disconnect")
async def disconnect_email():
    """Disconnect both OAuth token and IMAP credentials."""
    email_agent.disconnect_all()
    return {"status": "disconnected", "connection_info": email_agent.get_connection_info()}

@app.post("/api/auth/google/disconnect")
async def disconnect_google():
    email_agent.disconnect_all()
    return {"status": "disconnected"}

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    email_user: Optional[str] = None
    email_password: Optional[str] = None
    default_city: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: Optional[str] = None

@app.get("/api/settings")
async def get_settings():
    return {
        "gemini_api_key_set": bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_api_key_here"),
        "gemini_model": settings.GEMINI_MODEL,
        "elevenlabs_api_key_set": bool(settings.ELEVENLABS_API_KEY),
        "elevenlabs_is_valid_format": bool(settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_API_KEY.startswith("sk_")),
        "elevenlabs_voice_id": settings.ELEVENLABS_VOICE_ID,
        "email_user": settings.EMAIL_USER,
        "email_connected": bool(settings.EMAIL_USER and settings.EMAIL_PASSWORD),
        "default_city": settings.DEFAULT_CITY
    }

@app.post("/api/settings")
async def update_settings(payload: SettingsUpdate):
    global supervisor
    if payload.gemini_api_key:
        settings.GEMINI_API_KEY = payload.gemini_api_key
        email_agent._save_to_env("GEMINI_API_KEY", payload.gemini_api_key)
    if payload.elevenlabs_api_key is not None:
        settings.ELEVENLABS_API_KEY = payload.elevenlabs_api_key
        email_agent._save_to_env("ELEVENLABS_API_KEY", payload.elevenlabs_api_key)
    if payload.elevenlabs_voice_id is not None:
        settings.ELEVENLABS_VOICE_ID = payload.elevenlabs_voice_id
        email_agent._save_to_env("ELEVENLABS_VOICE_ID", payload.elevenlabs_voice_id)
    if payload.email_user is not None:
        settings.EMAIL_USER = payload.email_user
        email_agent._save_to_env("EMAIL_USER", payload.email_user)
    if payload.email_password is not None:
        settings.EMAIL_PASSWORD = payload.email_password
        email_agent._save_to_env("EMAIL_PASSWORD", payload.email_password)
    if payload.default_city:
        settings.DEFAULT_CITY = payload.default_city
        email_agent._save_to_env("DEFAULT_CITY", payload.default_city)
    
    # Re-initialize supervisor to apply new Gemini keys
    supervisor = SupervisorAgent()
    return {
        "status": "updated",
        "gemini_ready": supervisor.gemini_ready,
        "elevenlabs_ready": bool(settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_API_KEY.startswith("sk_"))
    }

# ---------------------------------------------------------------------------
# Mount Static Frontend Build (for Railway full-stack deployment)
# ---------------------------------------------------------------------------
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
