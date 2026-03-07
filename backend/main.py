from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import auth, credentials
import os
import json
from typing import List, Optional
from urllib.parse import unquote
from database import SessionLocal, StudyMaterial, Timetable, Assignment, Flashcard, DailyPlan, init_db
from dotenv import load_dotenv

# 1. Setup environment and Database
load_dotenv()
app = FastAPI(title="brAInwave API", version="1.0.0")

# Initialize Firebase Admin
firebase_env = os.environ.get("FIREBASE_SERVICE_ACCOUNT")

if firebase_env:
    cred = credentials.Certificate(json.loads(firebase_env))
else:
    cred = credentials.Certificate("serviceAccountKey.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

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

# Auth Dependency
def verify_token(authorization: str = Header(...)):
    """
    Verifies the Firebase ID token and returns the UID.
    All endpoints use this — user_id is never trusted from the client.
    """
    try:
        token = authorization.replace("Bearer ", "")
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")

# --- Schemas ---
class StudyMaterialSync(BaseModel):
    title: str
    rawContent: str
    aiPlan: Optional[str] = ""

class FlashcardBase(BaseModel):
    question: str
    answer: str

class FlashcardList(BaseModel):
    flashcards: List[FlashcardBase]

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
    date: str
    # Preferences
    isMorningPerson: bool
    preferredSessionLength: str
    mode: str
    subjectPriorities: List[str]
    # Tasks
    classes: Optional[List[ClassItem]] = None
    customTasks: Optional[List[CustomTask]] = None
    userNote: Optional[str] = None

# --- Routes ---

@app.post("/upload-syllabus")
async def processSyllabus(user_id: str = Depends(verify_token), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Analyzes a syllabus PDF/image and generates a study plan using Gemini.
    Saves to Supabase (via SQLAlchemy).
    """
    try:
        fileName = unquote(file.filename or "Uploaded_syllabus")
        cleanTitle = fileName.rsplit('.', 1)[0].replace('_', ' ')
        content = await file.read()
        mime_type = file.content_type or "text/plain"

        prompt = """
        You are brAInwave, a smart study planning assistant for college students. Analyze this syllabus/study material and create a comprehensive, personalized study plan. Break down the content into manageable sections, suggest study techniques, and recommend a timeline for effective learning. Your study plan should include: 1. Key topics & concepts - Break down the syllabus into main topics. 2. Week-by-week breakdown - Create a realistic timeline 3. Time allocation - Suggest how long to spend on each topic. 4. Study techniques - Recommend the best methods to learn this material, like active recall, spaced repetition, etc. 5. Important dates - Note any deadlines, exams, or milestones. 6. Retention tips - Give advice for long-term learning, not just cramming 7. Progress checkpoints - Suggest ways to test understanding along the way. Make it friendly, encouraging, and realistic for a busy student. Keep the tone motivating but honest about the work required.

        CRITICAL: Do NOT use LaTeX for mathematical or logical symbols. Use standard Unicode characters only (e.g., ∀, ∃, Δ, →, ∑, √). Ensure all math is readable as plain text.
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
            user_id=user_id,
            title=cleanTitle,
            rawContent=f"Uploaded {fileName}",
            aiPlan=studyPlan,
            file_uri=fileName,
            file_type=mime_type
        )
        db.add(material)
        db.commit()
        db.refresh(material)

        return {"status": "success", "id": material.id, "studyPlan": studyPlan}

    except Exception as e:
        print(f"Syllabus error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-assignment")
async def processAssignment(user_id: str = Depends(verify_token), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Extracts metadata from an assignment PDF and generates a master study plan.
    Saves to Supabase.
    """
    try:
        fileName = unquote(file.filename or "Uploaded_assignment")
        content = await file.read()
        mime_type = file.content_type or "application/pdf"

        meta_prompt = """
        Analyze this assignment document and extract the following information in JSON format:
        - title: A descriptive title for the assignment.
        - subject: The academic subject (e.g., Computer Science, History).
        - due_date: The deadline in YYYY-MM-DD format. If not found, use a date 7 days from now.
        - priority: One of 'low', 'medium', or 'high' based on the complexity or weight described.
        """

        meta_response = client.models.generate_content(
            model="gemini-3-flash-preview",
            config=types.GenerateContentConfig(response_mime_type="application/json"),
            contents=[
                types.Part.from_text(text=meta_prompt),
                types.Part.from_bytes(data=content, mime_type=mime_type)
            ]
        )

        if not meta_response.text:
            raise HTTPException(status_code=500, detail="Failed to extract assignment metadata")

        meta_data = json.loads(meta_response.text)

        guide_prompt = """
        You are brAInwave, a specialized academic consultant. Create a comprehensive 'Master Plan' study guide for this specific assignment.
        The plan must be in beautiful Markdown format and include:
        - Assignment Overview: What needs to be done.
        - Strategic Checklist: Step-by-step actionable tasks to complete the assignment.
        - Research & Resources: What theories, books, or data sources might be helpful.
        - Structural Guide: How to structure the final output (e.g., Intro, Body, Conclusion).
        - Pro Tips: Advice on avoiding common pitfalls or maximizing marks.

        Make it encouraging and professional.
        """

        guide_response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=[
                types.Part.from_text(text=guide_prompt),
                types.Part.from_bytes(data=content, mime_type=mime_type)
            ]
        )

        master_plan = guide_response.text

        new_assignment = Assignment(
            user_id=user_id,
            title=meta_data.get("title", "Unknown Assignment"),
            subject=meta_data.get("subject", "General"),
            due_date=meta_data.get("due_date"),
            priority=meta_data.get("priority", "medium"),
            rawContent=master_plan,
            file_uri=fileName,
            file_type=mime_type
        )
        db.add(new_assignment)
        db.commit()
        db.refresh(new_assignment)

        meta_data["rawContent"] = master_plan
        return {"status": "success", "id": new_assignment.id, "assignment": meta_data}

    except Exception as e:
        print(f"Assignment upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/assignments")
async def listAssignments(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    assignments = db.query(Assignment).filter(
        Assignment.user_id == user_id,
        Assignment.is_deleted == 0
    ).order_by(Assignment.due_date.asc()).all()
    return {"assignments": assignments}

@app.get("/assignment/{assignment_id}")
async def getAssignment(assignment_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.user_id == user_id,
        Assignment.is_deleted == 0
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return assignment

@app.delete("/assignment/{assignment_id}")
async def deleteAssignment(assignment_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.user_id == user_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")

    db.delete(assignment)
    db.commit()
    return {"status": "success", "message": "Assignment deleted successfully"}

@app.post("/upload-timetable")
async def uploadTimetable(user_id: str = Depends(verify_token), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Parses a timetable PDF to extract a weekly class template.
    Saves to Supabase.
    """
    content = await file.read()
    prompt = """
        You are brAInwave, a smart study planning assistant for college students.
        Extract the class schedule from this document.
        Return a JSON object with a key 'weekly_template'.
        'weekly_template' must be an object where keys are 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'.
        Each day contains a list of classes with: 'subject', 'time', 'room'.

        CRITICAL INSTRUCTIONS:
        1. Extract the 'time' exactly as it appears in the document (e.g., "10:00 - 11:00").
        2. Do NOT adjust the time for timezones or any other reason.
        3. If a day has no classes, return an empty list for that day.
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

    newTimetable = Timetable(
        user_id=user_id,
        title=f"Imported {datetime.now().strftime('%Y-%m-%d')}",
        structuredData=json.dumps(weeklyTemplate)
    )
    db.add(newTimetable)
    db.commit()
    db.refresh(newTimetable)

    return {"id": newTimetable.id, "user_id": user_id, "weekly_template": weeklyTemplate}

@app.get("/timetables")
async def listTimetables(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    timetables = db.query(Timetable).filter(
        Timetable.user_id == user_id,
        Timetable.is_deleted == 0
    ).order_by(Timetable.created_at.desc()).all()
    result = []
    for t in timetables:
        result.append({
            "id": t.id,
            "user_id": t.user_id,
            "title": t.title,
            "structuredData": json.loads(str(t.structuredData)),
            "created_at": t.created_at
        })
    return {"timetables": result}

@app.delete("/timetable/{timetable_id}")
async def deleteTimetable(timetable_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    timetable = db.query(Timetable).filter(
        Timetable.id == timetable_id,
        Timetable.user_id == user_id
    ).first()
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found.")

    db.delete(timetable)
    db.commit()
    return {"status": "success", "message": "Timetable deleted successfully"}

@app.post("/timetables")
async def syncTimetable(data: TimetableSync, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    newTimetable = Timetable(
        user_id=user_id,
        title=data.title,
        structuredData=json.dumps(data.structuredData)
    )
    db.add(newTimetable)
    db.commit()
    db.refresh(newTimetable)
    return {"id": newTimetable.id, "status": "synced"}

@app.post("/study-materials")
async def syncStudyMaterial(data: StudyMaterialSync, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    """
    Syncs a text-only study material to Supabase.
    Used by syncDirtyRecords for materials without a file.
    """
    material = StudyMaterial(
        user_id=user_id,
        title=data.title,
        rawContent=data.rawContent,
        aiPlan=data.aiPlan
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return {"id": material.id, "status": "synced"}

@app.post("/daily-plan")
async def saveDailyPlan(data: dict, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    """
    Saves or updates a daily plan to Supabase.
    """
    date = data.get("date")
    items = data.get("items")
    items_json = json.dumps(items)

    plan = db.query(DailyPlan).filter(
        DailyPlan.user_id == user_id,
        DailyPlan.date == date
    ).first()

    if plan:
        plan.items_json = items_json
        plan.generated_at = datetime.now(timezone.utc)
    else:
        plan = DailyPlan(user_id=user_id, date=date, items_json=items_json)
        db.add(plan)

    db.commit()
    db.refresh(plan)
    return {"status": "success", "id": plan.id}

@app.post("/generate-plan")
async def generateDailyPlan(request: PlanRequest, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    """
    Uses Gemini to generate a personalized daily study schedule.
    Saves the result to Supabase.
    """
    try:
        timetable = db.query(Timetable).filter(
            Timetable.user_id == user_id
        ).order_by(Timetable.created_at.desc()).first()

        if not timetable:
            raise HTTPException(status_code=404, detail="Please upload a timetable first")

        weeklyTemplate = json.loads(str(timetable.structuredData))

        dayOfWeekName = datetime.strptime(request.date, "%Y-%m-%d").strftime("%A")
        todaysClasses = weeklyTemplate.get(dayOfWeekName.lower(), [])
        customTaskList = [t.model_dump() for t in request.customTasks] if request.customTasks else []

        prefs = {
            "isMorningPerson": request.isMorningPerson,
            "sessionLength": request.preferredSessionLength,
            "mode": request.mode,
            "subjectPriorities": request.subjectPriorities
        }

        assignments = db.query(Assignment).filter(
            Assignment.user_id == user_id,
            Assignment.is_deleted == 0
        ).all()
        assignment_list = [{"title": a.title, "due_date": a.due_date, "priority": a.priority} for a in assignments]

        generatedItems = await aiOptimization(
            classes=todaysClasses,
            assignments=assignment_list,
            date=request.date,
            dayOfWeek=dayOfWeekName.capitalize(),
            prefs=prefs,
            customTasks=customTaskList,
            userNote=request.userNote
        )

        items_json = json.dumps(generatedItems)
        plan = db.query(DailyPlan).filter(
            DailyPlan.user_id == user_id,
            DailyPlan.date == request.date
        ).first()

        if plan:
            plan.items_json = items_json
            plan.generated_at = datetime.now(timezone.utc)
        else:
            plan = DailyPlan(user_id=user_id, date=request.date, items_json=items_json)
            db.add(plan)

        db.commit()

        return {"success": True, "items": generatedItems}

    except Exception as e:
        print(f"Error generating plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def aiOptimization(classes, assignments, date, dayOfWeek, prefs, customTasks=None, userNote=None):
    customContext = json.dumps(customTasks) if customTasks else "None"

    lengthMap = {"short": "25-45", "medium": "45-75", "long": "90-120"}
    targetRange = lengthMap.get(prefs.get('sessionLength', ''), "45-75")

    priorityList = prefs.get('subjectPriorities', [])
    priorityContext = ", ".join(priorityList) if priorityList else "Balanced"

    userInstruction = ""
    if userNote and userNote.strip():
        userInstruction = f"\n\n--- USER'S ADDITIONAL INSTRUCTIONS ---\n{userNote.strip()[:200]}\nTreat this as a high-priority preference when building the schedule."

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
        {userInstruction}

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

@app.get("/daily-plans")
async def listDailyPlans(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    plans = db.query(DailyPlan).filter(
        DailyPlan.user_id == user_id
    ).order_by(DailyPlan.date.desc()).all()

    result = []
    for plan in plans:
        result.append({
            "date": plan.date,
            "items": json.loads(str(plan.items_json))
        })

    return {"plans": result}

@app.get("/study-plan/{material_id}")
async def getStudyMaterial(material_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(
        StudyMaterial.id == material_id,
        StudyMaterial.user_id == user_id,
        StudyMaterial.is_deleted == 0
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study plan not found.")
    return {"id": material.id, "title": material.title, "aiPlan": material.aiPlan, "createdAt": material.created_at}

@app.get("/study-plans")
async def listStudyPlans(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    materials = db.query(StudyMaterial).filter(
        StudyMaterial.user_id == user_id,
        StudyMaterial.is_deleted == 0
    ).order_by(StudyMaterial.created_at.desc()).all()
    return {"count": len(materials), "plans": [{"id": m.id, "title": m.title, "createdAt": m.created_at} for m in materials]}

@app.get("/daily-plan/{date}")
async def getDailyPlan(date: str, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    try:
        plan = db.query(DailyPlan).filter(
            DailyPlan.user_id == user_id,
            DailyPlan.date == date
        ).first()
        if not plan:
            return {"items": []}
        return {"date": plan.date, "items": json.loads(str(plan.items_json))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/study-plan/{material_id}")
async def deleteStudyMaterial(material_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(
        StudyMaterial.id == material_id,
        StudyMaterial.user_id == user_id
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    db.delete(material)
    db.commit()
    return {"status": "success"}

@app.post("/generate-flashcards")
async def generateFlashcards(material_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    try:
        material = db.query(StudyMaterial).filter(
            StudyMaterial.id == material_id,
            StudyMaterial.user_id == user_id
        ).first()
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")

        prompt = f"""
        You are brAInwave, a study assistant. Analyze the following study material and generate a set of effective flashcards for active recall.

        MATERIAL TITLE: {material.title}
        CONTENT:
        {material.aiPlan}

        INSTRUCTIONS:
        1. Generate a minimum of 5 and maximum of 15 flashcards.
        2. Each flashcard must have a 'question' and an 'answer'.
        3. Make questions concise and focused on one concept.
        4. Make answers clear and informative.
        5. Return the result in JSON format with a key 'flashcards' containing an array of objects.
        """

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            config=types.GenerateContentConfig(response_mime_type="application/json"),
            contents=[prompt]
        )

        if not response.text:
            raise HTTPException(status_code=500, detail="Failed to generate flashcards")

        flashcardData = json.loads(response.text)
        cards = flashcardData.get("flashcards", [])

        db.query(Flashcard).filter(
            Flashcard.material_id == material_id,
            Flashcard.user_id == user_id
        ).delete()

        for card in cards:
            new_card = Flashcard(
                user_id=user_id,
                material_id=material_id,
                question=card['question'],
                answer=card['answer']
            )
            db.add(new_card)

        db.commit()
        return {"status": "success", "flashcards": cards}

    except Exception as e:
        print(f"Flashcard generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/flashcards/{material_id}")
async def getFlashcards(material_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    cards = db.query(Flashcard).filter(
        Flashcard.user_id == user_id,
        Flashcard.material_id == material_id
    ).all()
    return {"status": "success", "flashcards": cards}

@app.delete("/daily-plan/{date}/{task_id}")
async def deleteDailyTask(date: str, task_id: str, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    try:
        plan = db.query(DailyPlan).filter(
            DailyPlan.user_id == user_id,
            DailyPlan.date == date
        ).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Daily plan not found.")

        items = json.loads(str(plan.items_json))
        updated_items = [item for item in items if str(item.get("id")) != str(task_id)]

        if len(updated_items) == len(items):
            raise HTTPException(status_code=404, detail="Task not found in daily plan.")

        plan.items_json = json.dumps(updated_items)
        db.commit()
        return {"status": "success", "message": "Task deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def readRoot():
    return {"message": "brAInwave API running", "version": "1.0.0"}

@app.get("/health")
def healthCheck():
    return {"status": "ok"}