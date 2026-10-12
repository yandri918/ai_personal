import asyncio
import time
from typing import Optional, Callable, List
from google import genai

from .base import BaseAgent
from .email_agent import EmailAgent
from .market_agent import MarketAgent
from .weather_agent import WeatherAgent
from .advisor_agent import AdvisorAgent
from models import AssistantResponse, AgentLog, QueryRequest
from config import settings

class SupervisorAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="Supervisor Agent", role="Kepala Orkestrator & Perencana Tugas Multi-Agent")
        self.email_agent = EmailAgent()
        self.market_agent = MarketAgent()
        self.weather_agent = WeatherAgent()
        self.advisor_agent = AdvisorAgent()
        
        # Configure Gemini if key is provided
        self.gemini_ready = False
        self.client = None
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_api_key_here":
            try:
                self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
                self.gemini_ready = True
            except Exception:
                self.gemini_ready = False

    async def _plan_tasks(self, query: str, log_cb: Optional[Callable]) -> List[str]:
        await self.log("Menganalisis maksud pengguna dan menyusun rencana kerja delegasi agent...", "running", log_cb)
        
        plan = [
            "1. Pengecekan Kotak Masuk: Deteksi email darurat, tenggat waktu & penagihan (Email Agent)",
            "2. Analisis Pasar Finansial: Ambil pergerakan IHSG, Kurs Valas, Emas & Crypto terkini (Market Agent)",
            "3. Pengecekan Atmosfer Cuaca: Pantau suhu, indeks cuaca & potensi hujan (Weather Agent)",
            "4. Sintesis Rekomendasi: Hubungkan ketiga domain untuk memformulasikan saran terbaik (Advisor Agent)",
            "5. Pembuatan Executive Briefing: Rangkum arahan aksi harian secara terstruktur (Supervisor Agent)"
        ]
        
        await self.log(f"Rencana kerja disetujui ({len(plan)} tahapan eksekusi). Memulai orkestrasi paralel...", "info", log_cb)
        return plan

    async def _synthesize_with_gemini(
        self,
        query: str,
        email_summary: str,
        market_summary: str,
        weather_summary: str,
        advisor_summary: str
    ) -> str:
        prompt = f"""
Anda adalah SUPERVISOR AI ASISTEN PRIBADI tingkat eksekutif.
Pengguna meminta: "{query}"

Berikut adalah laporan real-time dari sub-agent Anda:
- [EMAIL AGENT]: {email_summary}
- [MARKET AGENT]: {market_summary}
- [WEATHER AGENT]: {weather_summary}
- [ADVISOR AGENT]: {advisor_summary}

Tugas Anda:
Berikan EXECUTIVE BRIEFING yang padat, ramah, profesional, dan actionable dalam Bahasa Indonesia.
Formatkan dengan jelas:
1. 💡 Highlight Utama Hari Ini
2. ⚡ Tindakan Prioritas Segera (Action Items)
3. 📊 Outlook Finansial & Pasar
4. ⛅ Panduan Mobilitas & Cuaca
5. 🎯 Kata Motivasi / Penutup
"""
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt
                )
            )
            return response.text
        except Exception:
            return self._fallback_synthesis(email_summary, market_summary, weather_summary, advisor_summary)

    def _fallback_synthesis(
        self,
        email_summary: str,
        market_summary: str,
        weather_summary: str,
        advisor_summary: str
    ) -> str:
        return f"""
### 📋 Executive Briefing Harian

Selamat datang! Berikut rangkuman terpadu hasil investigasi seluruh sub-agent untuk Anda:

#### ⚡ 1. Tindakan Prioritas (Email & Tugas)
{email_summary}
*Saran*: Segera balas email bertanda URGENT sebelum jam 15:00 WIB agar pekerjaan tim tidak terhambat.

#### 📊 2. Pasar & Keuangan
{market_summary}
*Saran*: Perhatikan fluktuasi kurs mata uang dan manfaatkan pergerakan aset untuk keputusan alokasi hari ini.

#### ⛅ 3. Cuaca & Mobilitas
{weather_summary}
*Saran*: Sesuaikan pakaian serta moda transportasi agar agenda harian Anda berjalan lancar tanpa kendala cuaca.

#### 🎯 4. Kesimpulan Strategis
{advisor_summary}
Tetap fokus pada prioritas utama dan selamat beraktivitas dengan produktif!
""".strip()

    async def execute(self, req: QueryRequest, log_cb: Optional[Callable] = None) -> AssistantResponse:
        start_time = time.time()
        logs_collected: List[AgentLog] = []

        async def internal_log_cb(entry: AgentLog):
            logs_collected.append(entry)
            if log_cb:
                if asyncio.iscoroutinefunction(log_cb):
                    await log_cb(entry)
                else:
                    log_cb(entry)

        await self.log(f"Menerima instruksi dari User: '{req.query}'", "info", internal_log_cb)

        # Step 1: Planning
        plan = await self._plan_tasks(req.query, internal_log_cb)

        # Step 2: Parallel execution of sub-agents
        await self.log("Mendelegasikan tugas ke Email Agent, Market Agent, dan Weather Agent secara simultan...", "running", internal_log_cb)
        
        email_task = asyncio.create_task(self.email_agent.execute(log_cb=internal_log_cb))
        market_task = asyncio.create_task(self.market_agent.execute(symbols=req.symbols, log_cb=internal_log_cb))
        weather_task = asyncio.create_task(self.weather_agent.execute(city=req.city or "Jakarta", log_cb=internal_log_cb))

        email_res, market_res, weather_res = await asyncio.gather(
            email_task, market_task, weather_task, return_exceptions=False
        )

        # Step 3: Advisor Agent
        await self.log("Sub-agent selesai. Mendelegasikan data gabungan ke Strategic Advisor Agent...", "running", internal_log_cb)
        advisor_res = await self.advisor_agent.execute(
            email_data=email_res,
            market_data=market_res,
            weather_data=weather_res,
            user_query=req.query,
            log_cb=internal_log_cb
        )

        # Step 4: Final Synthesis
        await self.log("Supervisor merumuskan sintesis eksekutif akhir untuk disajikan ke User...", "running", internal_log_cb)
        
        weather_desc = f"{weather_res.city}: {weather_res.temperature}°C, {weather_res.condition}. {weather_res.advisory}"
        
        if self.gemini_ready:
            try:
                final_text = await self._synthesize_with_gemini(
                    query=req.query,
                    email_summary=email_res.summary,
                    market_summary=market_res.summary,
                    weather_summary=weather_desc,
                    advisor_summary=advisor_res.executive_summary
                )
            except Exception:
                final_text = self._fallback_synthesis(email_res.summary, market_res.summary, weather_desc, advisor_res.executive_summary)
        else:
            final_text = self._fallback_synthesis(email_res.summary, market_res.summary, weather_desc, advisor_res.executive_summary)

        elapsed = round(time.time() - start_time, 2)
        await self.log(f"Seluruh pipeline multi-agent tuntas dieksekusi dalam {elapsed} detik.", "success", internal_log_cb)

        return AssistantResponse(
            query=req.query,
            supervisor_plan=plan,
            activated_agents=["Supervisor Agent", "Email Agent", "Market Agent", "Weather Agent", "Advisor Agent"],
            logs=logs_collected,
            email_data=email_res,
            market_data=market_res,
            weather_data=weather_res,
            advisor_data=advisor_res,
            final_synthesis=final_text,
            execution_time_sec=elapsed
        )
