import httpx
from typing import Optional, Callable
from .base import BaseAgent
from models import WeatherResult, WeatherForecastDay

WEATHER_CODE_MAP = {
    0: ("Cerah", "Cerah tanpa awan"),
    1: ("Sebagian Besar Cerah", "Langit sebagian besar cerah"),
    2: ("Sebagian Berawan", "Awan tipis tersebar"),
    3: ("Mendung", "Tertutup awan tebal"),
    45: ("Berkabut", "Jarak pandang terbatas"),
    48: ("Kabut Es", "Embun beku"),
    51: ("Gerimis Ringan", "Gerimis halus"),
    53: ("Gerimis Sedang", "Gerimis"),
    55: ("Gerimis Lebat", "Gerimis deras"),
    61: ("Hujan Ringan", "Hujan rintik-rintik"),
    63: ("Hujan Sedang", "Hujan reguler"),
    65: ("Hujan Deras", "Hujan lebat, waspada genangan"),
    71: ("Salju Ringan", "Butiran salju halus"),
    73: ("Salju Sedang", "Hujan salju"),
    75: ("Salju Lebat", "Badai salju"),
    80: ("Hujan Guyur Ringan", "Hujan tiba-tiba"),
    81: ("Hujan Guyur Sedang", "Hujan lebat sesaat"),
    82: ("Hujan Guyur Dahsyat", "Hujan sangat deras"),
    95: ("Badai Petir", "Waspada kilat dan petir"),
    96: ("Badai Petir Es Ringan", "Petir disertai butiran es"),
    99: ("Badai Petir Es Hebat", "Badai berbahaya"),
}

CITY_COORDINATES = {
    "jakarta": (-6.2088, 106.8456),
    "surabaya": (-7.2575, 112.7521),
    "bandung": (-6.9175, 107.6191),
    "semarang": (-6.9667, 110.4167),
    "medan": (3.5952, 98.6722),
    "makassar": (-5.1477, 119.4327),
    "denpasar": (-8.6705, 115.2126),
    "bali": (-8.4095, 115.1889),
    "yogyakarta": (-7.7956, 110.3695),
    "bogor": (-6.5971, 106.8060),
    "singapore": (1.3521, 103.8198),
    "tokyo": (35.6762, 139.6503),
}

class WeatherAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="Weather Agent", role="Pengecekan Cuaca & Prakiraan Atmosfer Real-Time")

    async def get_coordinates(self, city_name: str) -> tuple[float, float, str]:
        normalized = city_name.strip().lower()
        if normalized in CITY_COORDINATES:
            lat, lon = CITY_COORDINATES[normalized]
            return lat, lon, city_name.title()
        
        # Open-Meteo Geocoding
        async with httpx.AsyncClient(timeout=8.0) as client:
            try:
                resp = await client.get(
                    f"https://geocoding-api.open-meteo.com/v1/search?name={city_name}&count=1&language=id&format=json"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results")
                    if results and len(results) > 0:
                        res = results[0]
                        return res["latitude"], res["longitude"], res.get("name", city_name.title())
            except Exception:
                pass
        
        # Default to Jakarta if lookup fails
        return -6.2088, 106.8456, "Jakarta"

    async def execute(self, city: str = "Jakarta", log_cb: Optional[Callable] = None) -> WeatherResult:
        await self.log(f"Menganalisis data cuaca atmosfer terkini untuk kota: {city}", "running", log_cb)
        
        lat, lon, resolved_name = await self.get_coordinates(city)
        await self.log(f"Koordinat lokasi terdeteksi: ({lat:.4f}, {lon:.4f}) [{resolved_name}]", "info", log_cb)
        
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
            f"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max"
            f"&timezone=auto"
        )
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url)
                if res.status_code != 200:
                    raise RuntimeError(f"Open-Meteo API error: status {res.status_code}")
                
                data = res.json()
                current = data.get("current", {})
                daily = data.get("daily", {})
                
                w_code = current.get("weather_code", 0)
                condition, detail = WEATHER_CODE_MAP.get(w_code, ("Cerah Berawan", "Kondisi relatif stabil"))
                
                temp = current.get("temperature_2m", 28.0)
                humidity = current.get("relative_humidity_2m", 75)
                wind = current.get("wind_speed_10m", 12.0)
                
                precip_list = daily.get("precipitation_probability_max", [20])
                uv_list = daily.get("uv_index_max", [5.0])
                precip_prob = precip_list[0] if precip_list else 20
                uv_index = uv_list[0] if uv_list else 5.0
                
                forecast_days: list[WeatherForecastDay] = []
                dates = daily.get("time", [])
                max_temps = daily.get("temperature_2m_max", [])
                min_temps = daily.get("temperature_2m_min", [])
                daily_codes = daily.get("weather_code", [])
                
                for i in range(min(5, len(dates))):
                    d_code = daily_codes[i] if i < len(daily_codes) else 0
                    cond_name, _ = WEATHER_CODE_MAP.get(d_code, ("Cerah", ""))
                    forecast_days.append(
                        WeatherForecastDay(
                            date=dates[i],
                            temp_max=max_temps[i] if i < len(max_temps) else temp + 2,
                            temp_min=min_temps[i] if i < len(min_temps) else temp - 4,
                            condition=cond_name
                        )
                    )
                
                # Saran Cuaca
                advisory_parts = []
                if precip_prob > 50 or "Hujan" in condition or "Badai" in condition:
                    advisory_parts.append("Peluang hujan tinggi, siapkan payung dan rencanakan mobilitas luar ruang sebelum jam sore.")
                elif temp > 33:
                    advisory_parts.append("Cuaca panas menyengat, disarankan minum air yang cukup dan gunakan tabir surya.")
                else:
                    advisory_parts.append("Kondisi cuaca mendukung aktivitas luar ruangan.")
                
                if uv_index > 7:
                    advisory_parts.append(f"Indeks UV tinggi ({uv_index:.1f}), kurangi paparan langsung sinar matahari di siang hari.")
                
                advisory = " ".join(advisory_parts)
                
                result = WeatherResult(
                    city=resolved_name,
                    temperature=temp,
                    condition=condition,
                    humidity=humidity,
                    wind_speed_kmh=wind,
                    precipitation_prob=precip_prob,
                    uv_index=uv_index,
                    forecast=forecast_days,
                    advisory=advisory
                )
                
                await self.log(
                    f"Berhasil: Suhu {temp}°C, {condition}, Kelembaban {humidity}%, Potensi Hujan {precip_prob}%",
                    "success",
                    log_cb
                )
                return result

        except Exception as e:
            await self.log(f"Gagal mengambil cuaca API: {str(e)}. Menggunakan data cadangan cerdas.", "warning", log_cb)
            return WeatherResult(
                city=resolved_name,
                temperature=29.5,
                condition="Cerah Berawan",
                humidity=74,
                wind_speed_kmh=14.2,
                precipitation_prob=30,
                uv_index=6.4,
                forecast=[
                    WeatherForecastDay(date="Besok", temp_max=32.0, temp_min=24.5, condition="Hujan Ringan"),
                    WeatherForecastDay(date="Lusa", temp_max=31.5, temp_min=25.0, condition="Cerah Berawan")
                ],
                advisory="Suhu normal tropis, bawa payung lipat sebagai antisipasi cuaca sore hari."
            )
