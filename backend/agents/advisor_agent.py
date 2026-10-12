from typing import Optional, Callable
from .base import BaseAgent
from models import AdvisorResult, EmailResult, MarketResult, WeatherResult

class AdvisorAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="Strategic Advisor Agent", role="Sintesis Strategis Lintas-Domain & Rekomendasi Tindakan")

    async def execute(
        self,
        email_data: Optional[EmailResult],
        market_data: Optional[MarketResult],
        weather_data: Optional[WeatherResult],
        user_query: str,
        log_cb: Optional[Callable] = None
    ) -> AdvisorResult:
        await self.log("Menghubungkan data lintas-domain (Email + Pasar + Cuaca) untuk merumuskan saran holistik...", "running", log_cb)
        
        priority_actions = []
        operational_tips = []
        financial_tips = []
        mobility_health_tips = []
        
        # 1. Analisis Email
        if email_data:
            if email_data.urgent_count > 0:
                urgent_items = [e for e in email_data.emails if e.is_urgent]
                for u in urgent_items:
                    priority_actions.append(f"Tanggapi email penting dari {u.sender}: '{u.subject}'. {u.suggested_action}")
            operational_tips.append("Tinjau invoice server dan konfirmasi sprint demo tepat waktu.")
        
        # 2. Analisis Cuaca & Mobilitas
        if weather_data:
            temp = weather_data.temperature
            cond = weather_data.condition
            precip = weather_data.precipitation_prob
            city = weather_data.city
            
            if precip >= 40 or "Hujan" in cond:
                mobility_health_tips.append(
                    f"Peluang hujan di {city} mencapai {precip}% ({cond}). Selesaikan agenda luar kantor atau atur pertemuan secara daring sebelum jam 15:00."
                )
                mobility_health_tips.append("Bawa payung/jas hujan portabel di kendaraan dan perhatikan potensi perlambatan lalu lintas.")
            else:
                mobility_health_tips.append(
                    f"Cuaca di {city} bersahabat ({temp:.1f}°C, {cond}). Kondisi sangat optimal untuk mobilitas dan pertemuan tatap muka."
                )
                
            if temp >= 32:
                mobility_health_tips.append(f"Suhu terik {temp:.1f}°C: Pastikan asupan cairan cukup minimal 2 liter dan hindari dehidrasi.")
        
        # 3. Analisis Pasar & Keuangan
        if market_data:
            sentiment = market_data.market_sentiment
            # Cari USD/IDR dan IHSG
            usd_item = next((i for i in market_data.items if "IDR" in i.symbol), None)
            ihsg_item = next((i for i in market_data.items if "JKSE" in i.symbol), None)
            gold_item = next((i for i in market_data.items if "GC=F" in i.symbol), None)
            
            if usd_item and usd_item.price > 16000:
                financial_tips.append(
                    f"Kurs Rupiah berada di level {usd_item.price:,.0f}/USD. Jika memiliki pembayaran cloud/domain dalam USD, pertimbangkan hedging atau pelunasan tepat waktu."
                )
            
            if ihsg_item:
                if ihsg_item.trend == "up":
                    financial_tips.append(f"IHSG menguat ({ihsg_item.change_percent:+.2f}%). Momentum positif bagi portofolio saham blue-chip dan reksadana.")
                else:
                    financial_tips.append(f"IHSG terkoreksi ({ihsg_item.change_percent:+.2f}%). Tahan aksi spekulatif, prioritaskan averaging pada aset fundamental kuat.")
            
            if gold_item:
                financial_tips.append(f"Emas dunia diperdagangkan di USD {gold_item.price:,.2f}/oz ({gold_item.change_percent:+.2f}%), cocok sebagai aset defensif.")
                
            operational_tips.append(f"Sentimen pasar umum: {sentiment}. Pertahankan rasio likuiditas operasional yang aman.")
        
        # Fallback jika prioritas kosong
        if not priority_actions:
            priority_actions.append("Semua email terkendali. Alokasikan 2 jam blok fokus (Deep Work) untuk pekerjaan strategis.")
        
        exec_summary = (
            f"Fokus utama hari ini: Selesaikan {len(priority_actions)} prioritas kritis, "
            f"manfaatkan kondisi pasar berstatus '{market_data.market_sentiment if market_data else 'Netral'}', "
            f"serta antisipasi kondisi cuaca di {weather_data.city if weather_data else 'lokasi Anda'} untuk kelancaran aktivitas harian."
        )
        
        await self.log("Rekomendasi strategis berhasil diformulasikan secara komprehensif.", "success", log_cb)
        
        return AdvisorResult(
            executive_summary=exec_summary,
            priority_actions=priority_actions,
            operational_tips=operational_tips,
            financial_tips=financial_tips,
            mobility_health_tips=mobility_health_tips
        )
