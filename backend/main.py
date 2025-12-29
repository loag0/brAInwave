from fastapi import FastAPI, Depends, UploadFile, File
from sqlalchemy.orm import Session
from .database import SessionLocal, init_db, User, StudyMaterial
import httpx
import os

app = FastAPI()
init_db()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

HF_TOKEN = os.getenv("HF_TOKEN")

@app.post("/upload-syllabus")
async def process_syllabus(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 1. Read the file
    content = await file.read()
    text = content.decode("utf-8")
    
    # 2. Call Hugging Face (Planning)
    async with httpx.AsyncClient() as client:
        hf_resp = await client.post(
            "https://api-inference.huggingface.co/models/google/flan-t5-base",
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            json={"inputs": f"Create a study schedule for this: {text[:500]}"}
        )
        plan = hf_resp.json()[0].get("generated_text", "No plan generated")

    # 3. Save to SQLite
    material = StudyMaterial(title=file.filename, raw_content=text, ai_plan=plan)
    db.add(material)
    db.commit()
    
    return {"status": "success", "plan": plan}

# Keep your user routes below...