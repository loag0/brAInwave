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
from database import SessionLocal, StudyMaterial, Timetable, Assignment, Flashcard, DailyPlan, init_db, engine, CompletionLog
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
    All endpoints use this - user_id is never trusted from the client.
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

class DueDateUpdate(BaseModel):
    due_date: str
    due_time: Optional[str] = None

class TimetableSync(BaseModel):
    title: str
    structuredData: dict

class ClassItem(BaseModel):
    subject: str
    time: str
    room: str
    difficulty: Optional[str] = "medium"
    duration: Optional[str] = "60 min"

class CustomTask(BaseModel):
    task: str
    time: str
    duration: Optional[str] = "30 min"

class DailyPlanRequest(BaseModel):
    date: str
    items: list

class PlanRequest(BaseModel):
    date: str
    isMorningPerson: bool
    preferredSessionLength: str
    mode: str
    subjectPriorities: List[str]
    classes: Optional[List[ClassItem]] = None
    customTasks: Optional[List[CustomTask]] = None
    userNote: Optional[str] = None
    
class CompletionLogEntry(BaseModel):
    date: str
    minutes_studied: int
    module_tag: Optional[str] = None

class ModuleGoalSync(BaseModel):
    module_tag: str
    weekly_goal_minutes: int

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
        You are brAInwave, an AI study planning engine built for college students. Analyze this syllabus or study material and produce a structured, actionable study plan in clean Markdown.

        Your output MUST contain exactly these sections in this order:

        ## Course Overview
        2-3 sentences summarizing what this course/material is about, what skills it builds, and what the final assessment looks like.

        ## Key Topics & Concepts
        List every major topic extracted from the syllabus. Group related subtopics under each. Be exhaustive - don't skip anything listed in the document.

        ## Week-by-Week Study Timeline
        Break the content into a realistic weekly schedule from now until the end of the course or exam. Each week entry must include:
        - Which topics to cover
        - Suggested hours for that week
        - One specific study method suited to that week's content (e.g., "Use Cornell Notes for Week 1 - heavy theory load")

        ## Time Allocation Breakdown
        For each major topic, estimate total study hours needed and assign a priority level (High / Medium / Low) based on its weight in the course.

        ## Study Techniques by Topic Type
        Match specific techniques to the types of content in this course. Examples:
        - Heavy theory → Spaced repetition + summary sheets
        - Problem-solving → Worked examples + timed practice
        - Memorisation → Active recall flashcards
        - Essays/reports → Outline drafting + argument mapping
        Be specific to what is actually in THIS syllabus.

        ## Important Dates & Milestones
        Extract any explicitly stated deadlines, exam dates, or submission windows from the document. If none are found, write "No dates found in document - check with your lecturer."

        ## Progress Checkpoints
        Provide 4-6 self-assessment checkpoints spaced across the study timeline. Each checkpoint must include a specific question or mini-test the student can do to verify understanding before moving on.

        ## Retention Strategy
        3-5 evidence-based tips tailored to the content type in this course. Focus on long-term retention, not cramming. Be direct and specific - not generic advice.

        ---
        TONE: Sharp, encouraging, and honest. Write like a top tutor who knows what actually works for busy students.
        FORMATTING: Use Markdown only. No LaTeX. For any math or logic symbols use Unicode (e.g., ∀, ∃, Δ, →, ∑, √).
        LENGTH: Comprehensive but scannable. Use bullet points and sub-bullets, not dense paragraphs.
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
        You are brAInwave, an academic intelligence engine. Analyze this assignment document and extract the following fields as a JSON object:
        - title: A clear, descriptive title for the assignment (not just the filename).
        - subject: The academic subject or course this belongs to (e.g., "Software Engineering", "Macroeconomics").
        - due_date: The submission deadline in YYYY-MM-DD format. ONLY extract this if a date is explicitly written in the document. If no date is found, return null - do NOT guess or infer.
        - due_time: The submission time if explicitly specified (e.g., "23:59", "11:59 PM"). Return null if not found.
        - priority: Assess complexity, weight, and scope. Return one of: 'low', 'medium', or 'high'.
        - estimated_hours: Estimate realistic total hours needed to complete this assignment well. Return an integer.
        - assignment_type: Classify the work. One of: 'essay', 'report', 'project', 'coding', 'presentation', 'research', 'problem_set', or 'other'.
        - key_requirements: A JSON array of strings, each being one core requirement extracted directly from the document (e.g., ["Minimum 2500 words", "Harvard referencing", "Include UML diagrams"]). Max 6 items.
        - marking_criteria: A JSON array of strings describing how marks are allocated, if stated in the document. Return an empty array if not found.

        Be precise. Do not guess wildly - use only what is in the document.
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

        assignment_type = meta_data.get("assignment_type", "other")
        estimated_hours = meta_data.get("estimated_hours", "unknown")
        due_date = meta_data.get("due_date", "Not specified")
        due_time = meta_data.get("due_time")
        key_requirements = meta_data.get("key_requirements", [])
        marking_criteria = meta_data.get("marking_criteria", [])

        guide_prompt = f"""
        You are brAInwave, a specialized academic consultant and assignment strategist. Your job is to produce a detailed, battle-tested Master Plan for this specific assignment.

        --- ASSIGNMENT CONTEXT (already extracted) ---
        - Type: {assignment_type}
        - Estimated Hours to Complete: {estimated_hours}
        - Due Date: {due_date} {due_time or ""}
        - Key Requirements: {json.dumps(key_requirements)}
        - Marking Criteria: {json.dumps(marking_criteria)}

        Use this context to make every section of the plan specific and relevant. Do NOT write generic advice - every recommendation must reflect this assignment's type, scope, and requirements above.

        --- MASTER PLAN OUTPUT ---
        Produce the plan in clean, well-structured Markdown. Include all sections below, in this exact order:

        ## 1. Assignment Snapshot
        A concise 3-4 sentence breakdown of what this assignment requires, what the final deliverable looks like, and what a distinction-level submission achieves that a pass-level one does not.

        ## 2. Execution Checklist
        A numbered, phase-by-phase checklist of every action needed - from first read to final submission.
        Group into these exact phases: **Understand → Research → Draft → Review → Submit**
        Each item must be specific and actionable. Reference the key requirements above where relevant.
        For a {assignment_type} assignment, include steps specific to this format (e.g., for 'coding': environment setup, testing, documentation; for 'essay': argument mapping, citation formatting).

        ## 3. Resource Radar
        Suggest specific source types, theories, frameworks, or tools relevant to this exact assignment.
        - Academic sources: What type of literature is needed (primary research, textbooks, case studies)?
        - Methodologies or frameworks that apply to this {assignment_type}
        - Software/tools if applicable
        - Citation/referencing style if stated in requirements, otherwise recommend the most common for this subject area

        ## 4. Structure Blueprint
        A detailed outline for the final deliverable - tailored to a {assignment_type}:
        - For written work (essay/report/research): title page → abstract → introduction → body sections with suggested headings → conclusion → references
        - For coding/project: file/folder structure → key components → expected outputs → README
        - For presentation: slide-by-slide outline with suggested talking points and time allocation per slide
        - For problem_set: section-by-section breakdown with approach strategy per question type

        ## 5. Time Allocation Guide
        Break the {estimated_hours} estimated hours into phases. Show suggested hours per phase.
        Flag the most time-intensive phases. Recommend when to start each phase relative to the due date of {due_date}.

        ## 6. Mark-Maximizing Tips
        3-5 specific, high-value tips for THIS assignment type that most students overlook.
        If marking criteria were found, reference them directly. Be blunt about what separates distinction from pass.

        ## 7. Red Flags & Common Mistakes
        Top 3-5 mistakes students make on a {assignment_type} assignment. Be specific - not generic warnings.
        Include how to avoid each one.

        ---
        TONE: Sharp, direct, and encouraging. Like a tutor who has seen hundreds of students fail and succeed at this exact type of work.
        FORMATTING: Markdown only. No LaTeX. Unicode for any math symbols.
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
            due_time=meta_data.get("due_time"),
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

@app.patch("/assignment/{assignment_id}/due-date")
async def updateAssignmentDueDate(assignment_id: int, data: DueDateUpdate, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    # Fetch by id only - user_id verified via token, no filter needed
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail=f"Assignment {assignment_id} not found.")
    if assignment.user_id != str(user_id):
        raise HTTPException(status_code=403, detail=f"Forbidden: token={user_id} stored={assignment.user_id}")
    assignment.due_date = data.due_date
    if data.due_time is not None:
        assignment.due_time = data.due_time
    db.commit()
    return {"status": "success"}

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
        Each day contains a list of classes with: 'subject', 'time', 'room', 'difficulty', 'duration'.

        CRITICAL INSTRUCTIONS:
        1. Extract the 'time' exactly as it appears in the document (e.g., "10:00 - 11:00"). Do NOT adjust for timezones.
        2. For 'duration': calculate the length of the class from the time range and return it as a string (e.g., "60 min", "90 min", "2 hours"). If the time range is unclear, default to "60 min".
        3. If a day has no classes, return an empty list for that day.
        4. For 'difficulty': infer from the subject name using these rules:
           - Technical/mathematical subjects (e.g., Engineering, Physics, Calculus, Programming, Networks, Algorithms) → "hard"
           - Mixed/analytical subjects (e.g., Economics, Chemistry, Statistics, Business, Management) → "medium"
           - Humanities/language/social subjects (e.g., History, English, Sociology, Communication, Ethics) → "easy"
           - If unsure, default to "medium".
        5. For 'subject': use the exact course name as it appears in the document. Do not abbreviate or rename.
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
async def saveDailyPlan(data: DailyPlanRequest, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    pass

# --- Module Goal Sync ---

@app.get("/module-goals")
async def getModuleGoals(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    from database import ModuleGoal
    goals = db.query(ModuleGoal).filter(ModuleGoal.user_id == user_id).all()
    return {"goals": goals}

@app.post("/module-goals")
async def syncModuleGoals(goals: List[ModuleGoalSync], user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    from database import ModuleGoal

    db.query(ModuleGoal).filter(ModuleGoal.user_id == user_id).delete()
    
    new_goals = [
        ModuleGoal(
            user_id=user_id,
            module_tag=g.module_tag,
            weekly_goal_minutes=g.weekly_goal_minutes
        ) for g in goals
    ]
    db.add_all(new_goals)
    db.commit()
    return {"status": "success"}
    items_json = json.dumps(data.items)

    plan = db.query(DailyPlan).filter(
        DailyPlan.user_id == user_id,
        DailyPlan.date == data.date
    ).first()

    if plan:
        plan.items_json = items_json
        plan.generated_at = datetime.now(timezone.utc)
    else:
        plan = DailyPlan(user_id=user_id, date=data.date, items_json=items_json)
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

        materials = db.query(StudyMaterial).filter(
            StudyMaterial.user_id == user_id,
            StudyMaterial.is_deleted == 0
        ).all()
        materials_list = [{"title": m.title, "summary": m.aiPlan[:300] if m.aiPlan else "No details"} for m in materials]

        generatedItems = await aiOptimization(
            classes=todaysClasses,
            assignments=assignment_list,
            materials=materials_list,
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

async def aiOptimization(classes, assignments, materials, date, dayOfWeek, prefs, customTasks=None, userNote=None):
    customContext = json.dumps(customTasks) if customTasks else "None"
    materialsContext = json.dumps(materials) if materials else "None"

    lengthMap = {"short": "25-45", "medium": "45-75", "long": "90-120"}
    targetRange = lengthMap.get(prefs.get('sessionLength', ''), "45-75")

    priorityList = prefs.get('subjectPriorities', [])
    priorityContext = ", ".join(priorityList) if priorityList else "No priorities set - distribute evenly"

    userInstruction = ""
    if userNote and userNote.strip():
        userInstruction = f"\n\n--- USER'S ADDITIONAL INSTRUCTIONS ---\n{userNote.strip()[:200]}\nTreat this as a high-priority preference when building the schedule."

    # Build canonical subject name list for the model to reference
    class_subjects = [c.get("subject", "") for c in classes if c.get("subject")]
    assignment_subjects = [a.get("title", "") for a in assignments if a.get("title")]
    all_known_subjects = list(dict.fromkeys(class_subjects + priorityList + assignment_subjects))  # deduplicated, order preserved

    prompt = f"""
        You are brAInwave, a professional AI Study Architect. Your goal is to build a high-performance daily schedule tailored to a student's specific cognitive profile and academic load.

        SCHEDULE DATE: {dayOfWeek}, {date}

        --- USER COGNITIVE PROFILE ---
        - Energy Peak: {"MORNING - schedule Hard/high-priority study blocks before 12:00 PM" if prefs.get('isMorningPerson') else "EVENING - schedule Hard/high-priority study blocks after 4:00 PM"}
        - Preferred Study Block Length: {targetRange} minutes
        - Goal Mode: {prefs.get('mode', 'stay_consistent').replace('_', ' ')}
        - Subject Priorities (index 0 = highest priority): {priorityContext}

        --- DATA INPUTS ---
        - Today's Classes: {json.dumps(classes)}
        - Pending Assignments (title, due_date, priority): {json.dumps(assignments)}
        - Study Materials Context (Syllabus Snippets): {materialsContext}
        - User's Fixed Custom Tasks: {customContext}
            FIXED TASK RULES (MANDATORY - violating these is a critical failure):
            - Every item in Fixed Custom Tasks MUST appear in the output. Zero exceptions.
            - Place each at its EXACT stated time. Do not move, merge, or skip any.
            - Set "isCustom": true for ALL fixed task items.
            - If a fixed task overlaps a class block, keep BOTH - do not drop either.
            - Do not reinterpret or rename fixed tasks. Use the exact "task" string provided.

        {userInstruction}

        --- CANONICAL SUBJECT NAMES ---
        The ONLY subject names you are allowed to use in the output are from this list:
        {json.dumps(all_known_subjects)}
        If no matching subject exists for a task, use the closest match from this list. Never invent a subject name.

        --- SCHEDULING RULES ---
        1. CLASSES FIRST: Include every class from Today's Classes as a fixed block. Use each class's actual duration from the data. Mark these with "isCustom": false.
        2. FIXED TASKS (ZERO TOLERANCE): Every item in Fixed Custom Tasks is a hard constraint. 
            - Include ALL of them, at their exact times, with "isCustom": true.
            - Before finishing, verify: count Fixed Custom Tasks in input vs output. They must match.
        3. GAP ANALYSIS: Identify all free time gaps between fixed blocks.
        4. STUDY BLOCK ALLOCATION - The 3 Pillar Rule:
           - PILLAR 1 (Priority): Subjects at index 0-1 in Subject Priorities get the longest blocks ({targetRange}m) scheduled during the Energy Peak window.
           - PILLAR 2 (Urgency): Any assignment due within 48 hours from {date} MUST be scheduled, overriding all other priorities.
           - PILLAR 3 (Mode):
             * 'exam prep' → 70% of free gaps go to active recall / practice questions for top priority subject
             * 'catch up' → Dedicate multiple consecutive blocks to the single most overdue subject
             * 'stay consistent' → Rotate across 2-3 different subjects to maintain momentum
        5. HEALTH RULES:
           - No study blocks between 11:00 PM and 7:00 AM.
           - Insert a 15-minute Brain Break after every study block longer than 60 minutes.
        6. TASK DESCRIPTIONS: Each task's "task" field must be a specific, actionable instruction - not vague (e.g., "Complete Introduction section draft for Research Paper" not "Study Research Paper").

        --- OUTPUT FORMAT ---
        Return a JSON object with a single key "items" containing an array. Each item MUST follow this exact schema:
        {{
            "id": "unique_uuid_string",
            "time": "HH:MM AM/PM",
            "subject": "Exact name from Canonical Subject Names list",
            "task": "Specific actionable instruction",
            "duration": "X min",
            "completed": false,
            "difficulty": "easy" | "medium" | "hard",
            "isCustom": false
        }}
        For class blocks, set "task" to "Class Lecture" and use the subject name exactly as it appears in Today's Classes.
        For brain breaks, set "subject" to "Break", "difficulty" to "easy", "isCustom" to false.
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
            "tasks": json.loads(str(plan.items_json))
        })

    return {"plans": result}

@app.post("/completion-logs")
async def syncCompletionLogs(
    logs: List[CompletionLogEntry],
    user_id: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    for entry in logs:
        existing = db.query(CompletionLog).filter(
            CompletionLog.user_id == user_id,
            CompletionLog.date == entry.date,
            CompletionLog.module_tag == entry.module_tag
        ).first()

        if existing:
            existing.minutes_studied = entry.minutes_studied # replace, not increment
        else:
            db.add(CompletionLog(
                user_id=user_id,
                date=entry.date,
                minutes_studied=entry.minutes_studied,
                module_tag=entry.module_tag,
            ))
    db.commit()
    return {"status": "success"}
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

        # Infer subject type to tailor flashcard style
        title_lower = material.title.lower()
        if any(k in title_lower for k in ["math", "calculus", "physics", "algorithm", "network", "engineer", "code", "programming", "software"]):
            subject_type = "technical/mathematical"
            card_style = "Focus on definitions, formulas, algorithms, and step-by-step problem-solving processes. Questions should test application, not just recall."
        elif any(k in title_lower for k in ["econ", "business", "management", "finance", "account"]):
            subject_type = "analytical/business"
            card_style = "Focus on concepts, models, frameworks, and their real-world applications. Include cause-and-effect questions."
        else:
            subject_type = "conceptual/humanities"
            card_style = "Focus on key arguments, definitions, theories, dates, and their significance. Questions should test understanding of relationships between ideas."

        # Determine card count based on content length
        content_length = len(material.aiPlan or "")
        card_count = 10 if content_length > 3000 else 7 if content_length > 1500 else 5

        prompt = f"""
        You are brAInwave, a study assistant specializing in active recall techniques. Generate a set of high-quality flashcards from the study material below.

        MATERIAL TITLE: {material.title}
        SUBJECT TYPE: {subject_type}
        CARD STYLE DIRECTIVE: {card_style}

        CONTENT:
        {material.aiPlan}

        INSTRUCTIONS:
        1. Generate exactly {card_count} flashcards. No more, no less.
        2. Distribute difficulty evenly: approximately 1/3 easy, 1/3 medium, 1/3 hard.
        3. Each flashcard must have:
           - "question": A concise, single-concept question. No multi-part questions.
           - "answer": A clear, complete answer. For technical topics, include the formula or step-by-step if relevant. Max 3 sentences.
           - "difficulty": "easy", "medium", or "hard"
        4. Easy cards: test direct recall of definitions or facts.
        5. Medium cards: test understanding of how concepts relate or work.
        6. Hard cards: test application, edge cases, or "why" questions that require synthesis.
        7. Do NOT generate trivial or obvious questions. Every card must be genuinely useful for exam prep.
        8. Return JSON with a single key "flashcards" containing an array of objects.

        SUBJECT COHERENCE: Every question must be directly relevant to {material.title}. Do not generate generic study tips or off-topic questions.
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