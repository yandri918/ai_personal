from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class AgentLog(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now().strftime("%H:%M:%S"))
    agent: str
    message: str
    status: str = "info" # info, running, success, warning, error
    metadata: Optional[Dict[str, Any]] = None

class EmailItem(BaseModel):
    id: str
    sender: str
    subject: str
    date: str
    snippet: str
    is_urgent: bool = False
    category: str = "Umum" # Urgent, Pekerjaan, Keuangan, Update, Promo
    suggested_action: Optional[str] = None

class EmailResult(BaseModel):
    source: str = "real" # "real_imap" or "simulated"
    total_emails: int = 0
    urgent_count: int = 0
    emails: List[EmailItem] = []
    summary: str = ""

class MarketItem(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    currency: str = "IDR"
    trend: str = "flat" # up, down, flat

class MarketResult(BaseModel):
    items: List[MarketItem] = []
    market_sentiment: str = "Netral" # Bullish, Bearish, Netral, Volatil
    summary: str = ""
    key_takeaways: List[str] = []

class WeatherForecastDay(BaseModel):
    date: str
    temp_max: float
    temp_min: float
    condition: str

class WeatherResult(BaseModel):
    city: str
    temperature: float
    condition: str
    humidity: int
    wind_speed_kmh: float
    precipitation_prob: int
    uv_index: float
    forecast: List[WeatherForecastDay] = []
    advisory: str = ""

class AdvisorResult(BaseModel):
    executive_summary: str
    priority_actions: List[str] = []
    operational_tips: List[str] = []
    financial_tips: List[str] = []
    mobility_health_tips: List[str] = []

class DriveFileItem(BaseModel):
    id: str
    name: str
    mime_type: str = "application/octet-stream"
    icon_type: str = "file" # doc, sheet, slide, pdf, folder, file
    modified_time: Optional[str] = None
    size_bytes: Optional[int] = None
    web_view_link: Optional[str] = None
    snippet: Optional[str] = None

class DriveResult(BaseModel):
    source: str = "real" # "real_gdrive" or "demo"
    connected: bool = True
    total_files: int = 0
    recent_files: List[DriveFileItem] = []
    matched_files: List[DriveFileItem] = []
    summary: str = ""

class AssistantResponse(BaseModel):
    query: str
    supervisor_plan: List[str] = []
    activated_agents: List[str] = []
    logs: List[AgentLog] = []
    email_data: Optional[EmailResult] = None
    drive_data: Optional[DriveResult] = None
    market_data: Optional[MarketResult] = None
    weather_data: Optional[WeatherResult] = None
    advisor_data: Optional[AdvisorResult] = None
    final_synthesis: str = ""
    execution_time_sec: float = 0.0

class QueryRequest(BaseModel):
    query: str
    city: Optional[str] = "Jakarta"
    symbols: Optional[List[str]] = None
    force_all_agents: bool = True

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    chat_history: Optional[List[ChatMessage]] = []
    city: Optional[str] = "Jakarta"
    context_aware: Optional[bool] = True

class ChatResponse(BaseModel):
    reply: str
    context_used: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().strftime("%H:%M:%S"))

class MatchItem(BaseModel):
    league: str
    home_team: str
    away_team: str
    score: Optional[str] = "VS"
    status: str = "Upcoming"
    match_time: Optional[str] = "Malam Ini"
    source_url: str = "https://www.livescore.com/en/"

class SportsResult(BaseModel):
    source: str = "LiveScore via DuckDuckGo"
    total_matches: int = 0
    live_matches: int = 0
    matches: List[MatchItem] = []
    summary: str = ""
    featured_competitions: List[str] = []
