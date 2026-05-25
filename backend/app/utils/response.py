"""
Standardized API Response Utilities.
Ensures every endpoint returns data in the same format.
"""
from typing import Any, Optional
from fastapi.responses import JSONResponse

def success_response(data: Any = None, message: str = "Success", status_code: int = 200):
    return {
        "status": "success",
        "message": message,
        "data": data
    }

def error_response(message: str = "Error", status_code: int = 400, details: Any = None):
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "error",
            "message": message,
            "details": details
        }
    )
