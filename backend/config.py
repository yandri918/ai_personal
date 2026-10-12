import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    
    # ElevenLabs TTS settings
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    ELEVENLABS_MODEL_ID: str = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
    
    # Email settings (Optional IMAP for real Gmail/Outlook)
    IMAP_SERVER: str = os.getenv("IMAP_SERVER", "imap.gmail.com")
    IMAP_PORT: int = int(os.getenv("IMAP_PORT", "993"))
    EMAIL_USER: str = os.getenv("EMAIL_USER", "")
    EMAIL_PASSWORD: str = os.getenv("EMAIL_PASSWORD", "")
    
    # Weather settings
    DEFAULT_CITY: str = os.getenv("DEFAULT_CITY", "Jakarta")
    OPENWEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "")
    
    # Market & Forex default symbols (USD, JPY, AUD, IHSG, Gold, BTC)
    DEFAULT_MARKET_SYMBOLS: list[str] = [
        "IDR=X",       # USD to IDR (Dolar AS)
        "JPYIDR=X",    # JPY to IDR (Yen Jepang)
        "AUDIDR=X",    # AUD to IDR (Dolar Australia)
        "^JKSE",       # IHSG Indonesia
        "GC=F",        # Gold Futures
        "BTC-USD",     # Bitcoin
        "^GSPC",       # S&P 500
        "BBCA.JK",     # Bank Central Asia
    ]

settings = Settings()
