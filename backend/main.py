from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import firestore, credentials
from database import SessionLocal, StudyMaterial, init_db, Timetable
from dotenv import load_dotenv
import os
import json
from typing import List, Optional

# 1. Setup environment and Database
load_dotenv()
app = FastAPI(title = "brAInwave API", version = "1.0.0")
cred = credentials.Certificate("serviceAccountKey.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
    
db = firestore.client()

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
async def uploadTimetable(user_id: str, file: UploadFile = File(...)):
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
    
    timetableData = json.loads(response.text)
    extractedClasses = timetableData.get("classes", [])
    
    docRef = db.collection("users").document(user_id).collection("data").document("timetable")
    docRef.set({
        "classes": extractedClasses,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "user_id": user_id,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "classes": extractedClasses, 
    }

#This gets the day name
def getDayName(date_str: str):
    #converts "2026-02-05" to "Thursday"
    return datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")

@app.post("/generate-plan")
async def generateDailyPlan(request: PlanRequest):
    try:
        
        customTaskList = [t.model_dump() for t in request.customTasks] if request.customTasks else []
        
        if request.classes and len(request.classes) > 0:
            print("Using classes from request body...")
            classes = [c.model_dump() for c in request.classes]
            assignments = []
        else:
            print("Checking Firestore...")
            userDataRef = db.collection("users").document(request.user_id).collection("data").document("timetable")
            userData = userDataRef.get()
            
            if not userData.exists:
                raise HTTPException(status_code = 404, detail = "No timetable found in Firestore or Request body")
            
            data = userData.to_dict()
            classes = data.get("classes", [])
            assignments = data.get("assignments", [])
            #if there are classes passed in the request, it uses those
            
        dayOfWeek = getDayName(request.date)     
        
        #AI optimization for proper scheduling   
        generatedItems = await aiOptimization(classes, assignments, request.date, dayOfWeek, customTasks = customTaskList)
        print(f"Gemini returned {len(generatedItems)} items.")
        
        planRef = db.collection("users").document(request.user_id).collection("plans").document(request.date)
        planData = {
            "items": generatedItems,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "customTasksCount": len(customTaskList)
        }
        
        planRef.set(planData)
        print("SUCCESS: Firestore document created/updated.")
        
        return {
            "success": True,
            "items": generatedItems,
        }
    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        raise HTTPException(status_code = 500, detail = str(e))
    
async def aiOptimization(classes, assignments, date, dayOfWeek, customTasks = None):
    
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
        model = "gemini-3-flash-preview",
        config = types.GenerateContentConfig(response_mime_type = "application/json"),
        contents=[prompt]
    )
    
    if not response.text:
        raise HTTPException(status_code = 500, detail = "Failed to optimize schedule")
    
    result = json.loads(response.text)
    print(f"DEBUG: Gemini generated {len(result.get('items', []))} items")
    return result.get("items", [])
    
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
        "message": "Welcome to the brAInwave Backend API\n",
        "version": "1.0.0\n",
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