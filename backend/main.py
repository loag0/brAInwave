from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from database import SessionLocal, StudyMaterial, init_db, Timetable
from dotenv import load_dotenv
import os
import json

# 1. Setup environment and Database
load_dotenv()
app = FastAPI(title = "brAInwave API", version = "1.0.0")

@app.on_event("startup")
def on_startup():
    init_db()
    print("Database initialized.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

apiKey = os.getenv("GEMINI_API_KEY")

if not apiKey:
    raise ValueError("GEMINI_API_KEY not found in environment variables.")

client = genai.Client(api_key=apiKey)

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/upload-syllabus")
async def processSyllabus(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    This processes uploaded syllabus files and generates study plans using Gemini AI.
    """
    try:
        content = await file.read()
        mime_type = file.content_type or "text/plain"
        
        prompt = """
            You are brAInwave, a smart study planning assistant for college students. Analyze this syllabus/study material and create a comprehensive, personalized study plan. Break down the content into manageable sections, suggest study techniques, and recommend a timeline for effective learning.
            
            Your study plan should include:
            1. Key topics & concepts - Break down the syllabus into main topics.
            2. Week-by-week breakdown - Create a realistic timeline
            3. Time allocation - Suggest how long to spend on each topic.
            4. Study techniques - Recommend the best methods to learn this material, like active recall, spaced repetition, etc.
            5. Important dates - Note any deadlines, exams, or milestones.
            6. Retention tips - Give advice for long-term learning, not just cramming
            7. Progress checkpoints - Suggest ways to test understanding along the way.
            
            Make it friendly, encouraging, and realistic for a busy student. 
            Keep the tone motivating but honest about the work required.
       
        """
        
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=types.Content(
                parts=[
                    types.Part.from_text(text = prompt),
                    types.Part.from_bytes(
                        data=content,
                        mime_type=mime_type,
                    )
                ]
            )
        )
        
        studyPlan = response.text
            
        material = StudyMaterial(
            title = file.filename,
            rawContent = f"Uploaded {file.filename} with MIME type {mime_type}",
            aiPlan = studyPlan
        )
        db.add(material)
        db.commit()
        db.refresh(material)
            
        return {
            "status": "success",
            "id": material.id,
            "fileName": file.filename,
            "studyPlan": studyPlan,    
            "message": "Study plan generated successfully."
        }
    except Exception as e:
        print(f"DEBUG ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
     
     
@app.post("/upload-timetable")
async def uploadTimetable(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    This endpoint allows uploading structured timetable data in JSON format.
    """
    content = await file.read()
    
    prompt = """
        You are brAInwave, a smart study planning assistant for college students.
        Extract the class schedule from this document.
        Return a JSON object with a key 'classes' containing a list of class entries.
        Each object must have: 'subject', 'time', 'room', and 'days'
    """
    
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        config = types.GenerateContentConfig(response_mime_type="application/json"),
        contents=[
            types.Part.from_text(text = prompt),
            types.Part.from_bytes(
                data=content,
                mime_type=file.content_type or "application/octet-stream",
            )
        ]
    )
    
    if not response.text:
        raise HTTPException(status_code=500, detail="Failed to generate timetable data.")
    
    return json.loads(response.text)

#this lretrieves study material by id
@app.get("/study-plan/{material_id}")
async def getStudyMaterial(material_id: int, db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(StudyMaterial.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study plan not found.")
    
    return {
        "id": material.id,
        "title": material.title,
        "aiPlan": material.aiPlan,
        "CreatedAt": material.created_at,
    }     
       
#this lists all study plans for the student
@app.get("/study-plans")
async def listStudyPlans(db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).order_by(StudyMaterial.created_at.desc()).all()
    
    return {
        "count": len(material),
        "plans": [
            {
                "id": m.id,
                "title": m.title,
                "CreatedAt": m.created_at,
            }
            for m in material
        ]
    }
     
# deletes a study plan       
@app.delete("/study-plan/{material_id}")
async def deleteStudyMaterial(material_id: int, db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(StudyMaterial.id == material_id).first()
    
    if not material:
        raise HTTPException(status_code=404, detail="Study plan not found.")
    
    db.delete(material)
    db.commit()
    
    return {"status": "success", "message": "Study plan deleted successfully."}

@app.get("/")
def readRoot():
    return {
        "message": "Welcome to the brAInwave Backend API",
        "version": "1.0.0",
        "endpoints": {
            "upload": "/upload-syllabus [POST]",
            "getPlan": "/study-plan/{id} [GET, DELETE]",
            "listPlans": "/study-plans [GET]",
            "deletePlan": "/study-plan/{id} [DELETE]",
        }
            
    }
            
@app.get("/health")
def healthCheck():
    #Checking if the backend is running
    return {"status": "ok", "service": "brAInwave Backend API is running."}