import asyncio
from typing import Callable, Optional, Any
from models import AgentLog

class BaseAgent:
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role

    async def log(self, message: str, status: str = "info", callback: Optional[Callable] = None, metadata: Optional[dict] = None):
        log_entry = AgentLog(agent=self.name, message=message, status=status, metadata=metadata)
        if callback:
            if asyncio.iscoroutinefunction(callback):
                await callback(log_entry)
            else:
                callback(log_entry)
        return log_entry
