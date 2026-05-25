"""
Request logging middleware — logs every incoming request and its response time.
Helps with debugging and monitoring API performance.
"""
import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("api.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start) * 1000, 2)
        logger.info(
            f"{request.method} {request.url.path} "
            f"→ {response.status_code} [{duration_ms}ms]"
        )
        return response
