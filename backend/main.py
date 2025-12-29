from fastapi import FastAPI, Depends, UploadFile, File
from sqlalchemy.orm import Session
from database import SessionLocal, init_db, StudyMaterial
from dotenv import load_dotenv
import httpx
import os

# 1. Setup environment and Database
load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")
init_db()

app = FastAPI()

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/upload-syllabus")
async def process_syllabus(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Read the uploaded file
    content = await file.read()
    text = content.decode("utf-8")
    
    # 2025 Standard Base URL for Router
    API_URL = "https://router.huggingface.co/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Qwen 2.5 is currently the most reliable model on the HF Free Router
    payload = {
        "model": "Qwen/Qwen2.5-7B-Instruct",
        "messages": [
            {
                "role": "user", 
                "content": f"Summarize this syllabus and create a study plan: {text[:1000]}"
            }
        ],
        "max_tokens": 500
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(API_URL, headers=headers, json=payload, timeout=60.0)
            
            if response.status_code == 200:
                ai_data = response.json()
                plan = ai_data['choices'][0]['message']['content']
            else:
                # This will tell us if it's still a 404 or a different error
                plan = f"HF Error {response.status_code}: {response.text}"
                
    except Exception as e:
        plan = f"Connection Error: {str(e)}"

    # 2. Save the result to your SQLite Database
    material = StudyMaterial(
        title=file.filename, 
        raw_content=text, 
        ai_plan=plan
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    
    return {
        "status": "success", 
        "id": material.id, 
        "plan": plan
    }

@app.get("/")
def read_root():
    return {"message": "brAInwave Backend is Running"}