from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import firestore, credentials
from database import SessionLocal, StudyMaterial, Timetable, init_db
from dotenv import load_dotenv
import os
import json
from typing import List, Optional

# 1. Setup environment and Database
load_dotenv()
app = FastAPI(title="brAInwave API", version="1.0.0")

# Initialize Firestore
cred = credentials.Certificate("serviceAccountKey.json")
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
fs_db = firestore.client() 

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
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

# --- Schemas ---
class StudyMaterialSync(BaseModel):
    user_id: str  # Added for cohesion
    title: str
    rawContent: str
    aiPlan: str

class TimetableSync(BaseModel):
    title: str
    structuredData: dict

class ClassItem(BaseModel):
    subject: str
    time: str
    room: str
    days: str

class CustomTask(BaseModel):
    task: str
    time: str
    duration: Optional[str] = "30 min"

class PlanRequest(BaseModel):
    user_id: str
    date: str
    classes: Optional[List[ClassItem]] = None
    customTasks: Optional[List[CustomTask]] = None

# --- Routes ---

@app.post("/upload-syllabus")
async def processSyllabus(user_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
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
            contents=[
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(data=content, mime_type=mime_type)
            ]
        )
        
        if not response.text:
            raise HTTPException(status_code=500, detail="Failed to generate study plan")

        studyPlan = response.text
        material = StudyMaterial(
            user_id=user_id, # Link to user
            title=file.filename,
            rawContent=f"Uploaded {file.filename}",
            aiPlan=studyPlan
        )
        db.add(material)
        db.commit()
        db.refresh(material)
            
        return {"status": "success", "id": material.id, "studyPlan": studyPlan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-timetable")
async def uploadTimetable(user_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    prompt = """
        You are brAInwave, a smart study planning assistant for college students.
        Extract the class schedule from this document.
        Return a JSON object with a key 'weekly_template'.
        'weekly_template' must be an object where keys are 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'.
        Each day contains a list of classes with: 'subject', 'time', 'room'.
        If a day has no classes, return an empty list for that day
    """
    
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        config=types.GenerateContentConfig(response_mime_type="application/json"),
        contents=[
            types.Part.from_text(text=prompt),
            types.Part.from_bytes(data=content, mime_type=file.content_type or "application/octet-stream")
        ]
    )
    
    if not response.text:
        raise HTTPException(status_code=500, detail="Failed to generate timetable data.")
    
    timetableData = json.loads(response.text)
    weeklyTemplate = timetableData.get("weekly_template", {})
    
    # Cohesion: Save to SQL
    newTimetable = Timetable(
        user_id=user_id,
        title=f"Imported {datetime.now().strftime('%Y-%m-%d')}",
        structuredData=json.dumps(weeklyTemplate)
    )
    db.add(newTimetable)
    db.commit()

    # Cohesion: Sync to Firestore
    docRef = fs_db.collection("users").document(user_id).collection("data").document("timetable")
    docRef.set({
        "weekly_template": weeklyTemplate,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }, merge=True)
    
    return {"user_id": user_id, "weekly_template": weeklyTemplate}

@app.post("/timetables")
async def syncTimetable(user_id: str, data: TimetableSync, db: Session = Depends(get_db)):
    newTimetable = Timetable(
        user_id=user_id,
        title=data.title,
        structuredData=json.dumps(data.structuredData)
    )
    db.add(newTimetable)
    db.commit()
    
    docRef = fs_db.collection("users").document(user_id).collection("data").document("timetable")
    docRef.set({
        "weekly_template": data.structuredData,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }, merge=True)
    
    return {"id": newTimetable.id, "status": "synced"}

@app.post("/study-materials")
async def syncStudyMaterials(data: StudyMaterialSync, db: Session = Depends(get_db)):
    material = StudyMaterial(
        user_id=data.user_id,
        title=data.title,
        rawContent=data.rawContent,
        aiPlan=data.aiPlan,
        is_dirty=0
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return {"id": material.id, "status": "synced"}

@app.post("/generate-plan")
async def generateDailyPlan(request: PlanRequest):
    try:
        userDataRef = fs_db.collection("users").document(request.user_id).collection("data").document("timetable")
        userData = userDataRef.get()
        
        if not userData.exists:
            raise HTTPException(status_code=404, detail="Please upload a timetable first")
        
        data = userData.to_dict()
        weeklyTemplate = data.get("weekly_template", {})
        assignments = data.get("assignments", []) # Assumes assignments might exist in Firestore
        
        dayOfWeekName = datetime.strptime(request.date, "%Y-%m-%d").strftime("%A")
        todaysClasses = weeklyTemplate.get(dayOfWeekName.lower(), [])
        customTaskList = [t.model_dump() for t in request.customTasks] if request.customTasks else []
        
        generatedItems = await aiOptimization(todaysClasses, assignments, request.date, dayOfWeekName.capitalize(), customTasks=customTaskList)
        
        planRef = fs_db.collection("users").document(request.user_id).collection("plans").document(request.date)
        planRef.set({
            "items": generatedItems,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        })
        
        return {"success": True, "items": generatedItems}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def aiOptimization(classes, assignments, date, dayOfWeek, customTasks=None):
    customContext = json.dumps(customTasks) if customTasks else "None"
    prompt = f"""
        You are brAInwave, an AI study architect.
        Create a daily schedule for {dayOfWeek}, {date}.
        
        USER DATA:
        - Weekly Classes: {json.dumps(classes)}
        - Pending Assignments: {json.dumps(assignments)}
        - USER'S CUSTOM FIXED TASKS: {customContext}
        
        INSTRUCTIONS:
        1. Filter the 'Weekly Classes' to ONLY include classes where 'days' matches '{dayOfWeek}'
        2. MANDATORY: Include all 'USER'S CUSTOM FIXED TASKS' at their specified times. These are non-negotiable.
        3. OPTIMIZATION: Identify the remaining free gaps in the day.
        4. FILL GAPS: Insert study sessions for 'Pending Assignments' into those gaps.
        5. If an assignment is due soon, prioritize it.
        6. Structure the day logically (e.g., don't put a 3-hour study block at 2:00 AM )
        7. Return a JSON array of objects called 'items'.
        8. Each item MUST follow this schema:
            {{
                "id": "unique_string",
                "time": "e.g. 08:00 am",
                "subject": "Subject Name",
                "task": "Specify activity (e.g. 'Class Lecture' or 'Solve Calculus Ch.2')",
                "duration": "e.g. 90 min",
                "completed": false,
                "difficulty": "easy" | "medium" | "hard"
            }}
    """
    
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        config=types.GenerateContentConfig(response_mime_type="application/json"),
        contents=[prompt]
    )
    
    if not response.text:
        raise HTTPException(status_code=500, detail="Failed to generate plan")
    
    result = json.loads(response.text)
    return result.get("items", [])

@app.get("/study-plan/{user_id}/{material_id}")
async def getStudyMaterial(user_id: str, material_id: int, db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(StudyMaterial.id == material_id, StudyMaterial.user_id == user_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study plan not found.")
    return {"id": material.id, "title": material.title, "aiPlan": material.aiPlan}

@app.get("/study-plans/{user_id}")
async def listStudyPlans(user_id: str, db: Session = Depends(get_db)):
    materials = db.query(StudyMaterial).filter(StudyMaterial.user_id == user_id).order_by(StudyMaterial.created_at.desc()).all()
    return {"count": len(materials), "plans": [{"id": m.id, "title": m.title} for m in materials]}

@app.delete("/study-plan/{user_id}/{material_id}")
async def deleteStudyMaterial(user_id: str, material_id: int, db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(StudyMaterial.id == material_id, StudyMaterial.user_id == user_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study plan not found.")
    db.delete(material)
    db.commit()
    return {"status": "success"}

@app.get("/")
def readRoot():
    return {"message": "brAInwave API running", "version": "1.0.0"}

@app.get("/health")
def healthCheck():
    return {"status": "ok"}