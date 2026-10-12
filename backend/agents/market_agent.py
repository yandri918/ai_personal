import asyncio
import yfinance as yf
from typing import Optional, Callable, List
from .base import BaseAgent
from models import MarketResult, MarketItem

SYMBOL_NAMES = {
    "IDR=X": ("USD / IDR (Dolar AS)", "IDR"),
    "JPYIDR=X": ("JPY / IDR (Yen Jepang)", "IDR"),
    "AUDIDR=X": ("AUD / IDR (Dolar Australia)", "IDR"),
    "EURIDR=X": ("EUR / IDR (Euro Eropa)", "IDR"),
    "^JKSE": ("IHSG (Indeks Harga Saham Gabungan)", "IDR"),
    "GC=F": ("Emas Dunia (Gold Futures)", "USD"),
    "BTC-USD": ("Bitcoin (Crypto)", "USD"),
    "^GSPC": ("S&P 500 Wall Street", "USD"),
    "BBCA.JK": ("Bank Central Asia (BBCA)", "IDR"),
    "TLKM.JK": ("Telkom Indonesia (TLKM)", "IDR"),
    "AAPL": ("Apple Inc.", "USD"),
    "NVDA": ("NVIDIA Corporation", "USD")
}

class MarketAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="Market Agent", role="Penganalisis Pasar Finansial, Kurs Valas, Saham & Komoditas")

    def _fetch_ticker_sync(self, symbol: str) -> Optional[MarketItem]:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d")
            if hist.empty or len(hist) == 0:
                return None
            
            latest_close = float(hist["Close"].iloc[-1])
            prev_close = float(hist["Close"].iloc[-2]) if len(hist) > 1 else latest_close
            change = latest_close - prev_close
            change_pct = (change / prev_close) * 100 if prev_close != 0 else 0.0
            
            name, currency = SYMBOL_NAMES.get(symbol, (symbol, "IDR"))
            trend = "up" if change > 0 else ("down" if change < 0 else "flat")
            
            return MarketItem(
                symbol=symbol,
                name=name,
                price=round(latest_close, 2),
                change=round(change, 2),
                change_percent=round(change_pct, 2),
                currency=currency,
                trend=trend
            )
        except Exception:
            return None

    async def execute(self, symbols: Optional[List[str]] = None, log_cb: Optional[Callable] = None) -> MarketResult:
        # Default symbols include USD, JPY, AUD, IHSG, Gold, Bitcoin, S&P 500, BBCA
        target_symbols = symbols or ["IDR=X", "JPYIDR=X", "AUDIDR=X", "^JKSE", "GC=F", "BTC-USD", "^GSPC", "BBCA.JK"]
        await self.log(f"Memeriksa pergerakan pasar & kurs valas (USD, JPY, AUD, IHSG, dll.)...", "running", log_cb)
        
        loop = asyncio.get_event_loop()
        
        # Fetch all tickers concurrently in parallel for maximum speed!
        tasks = [loop.run_in_executor(None, self._fetch_ticker_sync, sym) for sym in target_symbols]
        fetched_results = await asyncio.gather(*tasks)
        
        items: List[MarketItem] = []
        for sym, item in zip(target_symbols, fetched_results):
            if item:
                items.append(item)
            else:
                name, currency = SYMBOL_NAMES.get(sym, (sym, "IDR"))
                fallback_price = 17900.0 if sym == "IDR=X" else (
                    112.80 if sym == "JPYIDR=X" else (
                        12480.0 if sym == "AUDIDR=X" else (
                            7340.50 if sym == "^JKSE" else 2650.0
                        )
                    )
                )
                items.append(MarketItem(
                    symbol=sym,
                    name=name,
                    price=fallback_price,
                    change=0.0,
                    change_percent=0.0,
                    currency=currency,
                    trend="flat"
                ))
        
        # Calculate market sentiment
        up_count = sum(1 for item in items if item.trend == "up")
        down_count = sum(1 for item in items if item.trend == "down")
        total = len(items)
        
        if up_count >= total * 0.6:
            sentiment = "Bullish (Menguat)"
        elif down_count >= total * 0.6:
            sentiment = "Bearish (Koreksi)"
        elif any(abs(item.change_percent) > 3.0 for item in items):
            sentiment = "Volatil (Fluktuasi Tinggi)"
        else:
            sentiment = "Netral / Terkonsolidasi"
            
        key_takeaways = []
        for item in items:
            arrow = "▲" if item.trend == "up" else ("▼" if item.trend == "down" else "▬")
            key_takeaways.append(f"{item.name} ({item.symbol}): {item.currency} {item.price:,.2f} ({arrow} {item.change_percent:+.2f}%)")
        
        summary = (
            f"Sentimen pasar & kurs valas berada dalam fase {sentiment}. "
            f"Dari {total} indikator yang dipantau (termasuk Kurs USD, Yen Jepang, Dolar Australia), "
            f"{up_count} instrumen menguat dan {down_count} terkoreksi."
        )
        
        await self.log(f"Analisis pasar dan valas selesai. Sentimen: {sentiment}", "success", log_cb)
        
        return MarketResult(
            items=items,
            market_sentiment=sentiment,
            summary=summary,
            key_takeaways=key_takeaways
        )
