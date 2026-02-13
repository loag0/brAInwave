from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from google.cloud.firestore import ArrayUnion
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
    # Preferences
    isMorningPerson: bool
    preferredSessionLength: str
    mode: str
    subjectPriorities: List[str]
    # Tasks
    classes: Optional[List[ClassItem]] = None
    customTasks: Optional[List[CustomTask]] = None

# --- Routes ---

@app.post("/upload-syllabus")
async def processSyllabus(user_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        mime_type = file.content_type or "text/plain"
        
        prompt = """Analyze this syllabus and create a study plan...""" # Keep your prompt here
        
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
        
        # 1. Save to Local SQL (Python Backend)
        material = StudyMaterial(
            user_id=user_id,
            title=file.filename,
            rawContent=f"Uploaded {file.filename}",
            aiPlan=studyPlan
        )
        db.add(material)
        db.commit()
        db.refresh(material)
        
        # 2. Sync to Firebase Firestore
        doc_ref = fs_db.collection("users").document(user_id).collection("data").document("materials")
        doc_ref.set({
            "syllabus_list": ArrayUnion([{
                "id": material.id,
                "title": file.filename,
                "aiPlan": studyPlan,
                "timestamp": datetime.now(timezone.utc)
            }])
        }, merge=True)

        return {"status": "success", "id": material.id, "studyPlan": studyPlan}

    except Exception as e:
        print(f"Syllabus error: {e}") # Log this so you can see it in your terminal
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
        # 1. Fetch data from Firestore
        userDataRef = fs_db.collection("users").document(request.user_id).collection("data").document("timetable")
        userData = userDataRef.get()
        
        if not userData.exists:
            raise HTTPException(status_code=404, detail="Please upload a timetable first")
        
        data = userData.to_dict()
        weeklyTemplate = data.get("weekly_template", {})
        assignments = data.get("assignments", []) 
        
        # 2. Prepare context
        dayOfWeekName = datetime.strptime(request.date, "%Y-%m-%d").strftime("%A")
        todaysClasses = weeklyTemplate.get(dayOfWeekName.lower(), [])
        customTaskList = [t.model_dump() for t in request.customTasks] if request.customTasks else []
        
        # 3. Bundle preferences for the AI
        prefs = {
            "isMorningPerson": request.isMorningPerson,
            "sessionLength": request.preferredSessionLength,
            "mode": request.mode,
            "subjectPriorities": request.subjectPriorities
        }
        
        # 4. Run AI Optimization
        generatedItems = await aiOptimization(
            classes=todaysClasses, 
            assignments=assignments, 
            date=request.date, 
            dayOfWeek=dayOfWeekName.capitalize(), 
            prefs=prefs, 
            customTasks=customTaskList
        )
        
        # 5. Save the generated plan back to Firestore
        planRef = fs_db.collection("users").document(request.user_id).collection("plans").document(request.date)
        planRef.set({
            "items": generatedItems,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        })
        
        return {"success": True, "items": generatedItems}
        
    except Exception as e:
        print(f"Error generating plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))
async def aiOptimization(classes, assignments, date, dayOfWeek, prefs, customTasks=None):
    customContext = json.dumps(customTasks) if customTasks else "None"
    
    lengthMap = {"short": "25-45", "medium": "45-75", "long": "90-120"}
    targetRange = lengthMap.get(prefs.get('sessionLength', ''), "45-75")
    
    priorityList = prefs.get('subjectPriorities', [])
    priorityContext = ", ".join(priorityList) if priorityList else "Balanced"
        
    prompt = f"""
        You are brAInwave, a professional AI Study Architect. Your goal is to build a high-performance daily schedule tailored to a student's specific cognitive profile and academic load.

        SCHEDULE DATE: {dayOfWeek}, {date}

        --- USER COGNITIVE PROFILE ---
        - Energy Peak: {"MORNING (Prioritize high-intensity 'Hard' tasks before 12:00 PM)" if prefs.get('isMorningPerson') else "EVENING (Prioritize high-intensity 'Hard' tasks after 4:00 PM)"}
        - Preferred Study Block: {targetRange} minutes
        - Goal Mode: {prefs.get('mode', 'stay_consistent').replace('_', ' ')}
        - Subject Priorities (Ranked Hardest to Easiest): {priorityContext}

        --- DATA INPUTS ---
        - Weekly Classes: {json.dumps(classes)}
        - Pending Assignments: {json.dumps(assignments)}
        - USER'S FIXED CUSTOM TASKS: {customContext}
        
        --- ARCHITECTURAL INSTRUCTIONS ---
        1. CLASS FILTERING: Only include classes from 'Weekly Classes' that occur on {dayOfWeek}.
        2. FIXED CONSTRAINTS: All 'USER'S FIXED CUSTOM TASKS' are non-negotiable. Place them exactly at their specified times.
        3. GAP ANALYSIS: Identify available time gaps between classes and fixed tasks.
        4. STUDY ALLOCATION (The 3 Pillar Rule):
            - PILLAR 1 (Difficulty): Subjects at the TOP of 'Subject Priorities' get the longest blocks ({targetRange}m) and are placed during the user's 'Energy Peak'.
            - PILLAR 2 (Urgency): Any 'Pending Assignment' due within 48 hours overrides priority ranks and must be scheduled.
            - PILLAR 3 (Goal Mode): 
                - 'Exam Prep': Allocate 70% of gaps to active recall/practice exams.
                - 'Catch Up': Focus on one subject for multiple back-to-back blocks.
                - 'Stay Consistent': Rotate through 2-3 different subjects to maintain variety.
        5. LOGIC & HEALTH: 
            - No study sessions between 11:00 PM and 7:00 AM unless the user isn't a morning person (even then, prioritize sleep).
            - Include 15-minute 'Brain Breaks' between study blocks.
        6. SUBJECT NAMES:
            - When setting the "subject" field, only use subject names that appear in Weekly Classes, Pending Assignments, or in the Subject Priorities list above.
            - Do NOT invent new or random subjects that the user has never seen.
        
        --- OUTPUT FORMAT ---
        Return a JSON object with a single key 'items' containing an array of objects.
        Each item MUST follow this schema:
        {{
            "id": "unique_uuid",
            "time": "hh:mm am/pm",
            "subject": "Name of subject or task",
            "task": "Specific actionable instruction (e.g., 'Draft Intro for History Paper')",
            "duration": "X min",
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

@app.get("/daily-plans/{user_id}")
async def listDailyPlans(user_id: str):
    plansRef = fs_db.collection("users").document(user_id).collection("plans")
    docs = plansRef.stream()
    
    plans = []
    for doc in docs:
        data = doc.to_dict()
        plans.append({
            "date": doc.id,
            "items": data.get("items", [])
        })
    
    return { "plans": plans }

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

@app.get("/daily-plan/{user_id}/{date}")
async def getDailyPlan(user_id: str, date: str):
    try:
        planRef = fs_db.collection("users").document(user_id).collection("plans").document(date)
        plan = planRef.get()
        if not plan.exists:
            return {"items": []}
        return plan.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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