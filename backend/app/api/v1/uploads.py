import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.utils.response import success_response

router = APIRouter()

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Return a relative URL so it works with the active frontend/backend ports.
    image_url = f"/api/uploads/{filename}"
    
    return success_response(
        data={"url": image_url, "filename": filename},
        message="Image uploaded successfully."
    )
