from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import auth, credentials
import os
import json
from typing import List, Optional
from urllib.parse import unquote
from database import SessionLocal, StudyMaterial, Timetable, Assignment, Flashcard, DailyPlan, init_db, engine, CompletionLog
from dotenv import load_dotenv
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
import time
import uuid

# 1. Setup environment and Database
load_dotenv()

# Maximum file upload size: 10MB
MAX_UPLOAD_SIZE = 10 * 1024 * 1024

# Rate limiting setup
def _rate_limit_key(request: Request) -> str:
    """Extract the Firebase token from the Authorization header as the rate limit key."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "")
    return token or (request.client.host if request.client else "unknown")

limiter = Limiter(key_func=_rate_limit_key)

app = FastAPI(title="brAInwave API", version="1.0.0")
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": f"Too many requests. Slow down cuh",
            "retry_after": exc.detail,
        },
    )

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

GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
]

def call_gemini(contents, config=None) -> str:
    """
    Call Gemini with automatic model fallback on 503/overload errors.
    Cycles through GEMINI_MODELS in order, waiting briefly between attempts.
    Returns the response text, or raises if all models fail.
    """
    last_error: Exception = RuntimeError("All Gemini models unavailable")
    for i, model in enumerate(GEMINI_MODELS):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                **({"config": config} if config else {})
            )
            try:
                text = response.text
            except Exception:
                text = None
            if not text:
                raise ValueError(f"Empty response from {model}")
            return text
        except Exception as e:
            last_error = e
            is_overload = any(
                kw in str(e).lower()
                for kw in ["503", "overloaded", "unavailable", "empty response"]
            )
            if is_overload and i < len(GEMINI_MODELS) - 1:
                time.sleep(2 ** i)  # 1s before 2.5-flash, 2s before flash-lite
                continue
            raise
    raise last_error

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

class ModuleTagUpdate(BaseModel):
    module_tag: Optional[str] = None

class UserProfileSchema(BaseModel):
    year_of_study: Optional[str] = Field(None, max_length=20)
    degree: Optional[str] = Field(None, max_length=120)
    weak_areas: Optional[List[str]] = Field(default_factory=list, max_length=15)

    @field_validator("year_of_study", "degree", mode="before")
    @classmethod
    def strip_and_sanitize_str(cls, v):
        if v is None:
            return v
        # Remove non-printable control chars, collapse whitespace
        cleaned = " ".join("".join(c for c in str(v) if c.isprintable()).split())
        return cleaned or None

    @field_validator("weak_areas", mode="before")
    @classmethod
    def sanitize_weak_areas(cls, v):
        if not v:
            return []
        return [
            " ".join("".join(c for c in str(s) if c.isprintable()).split())[:60]
            for s in v
            if isinstance(s, str) and s.strip()
        ][:15]

def sanitize_for_prompt(s: str, max_len: int = 120) -> str:
    """Strip control chars and cap length to reduce prompt injection surface."""
    if not s:
        return s
    cleaned = " ".join("".join(c for c in s if c.isprintable()).split())
    return cleaned[:max_len]

_SUBJECT_STOP_WORDS = {"and", "or", "of", "the", "to", "in", "for", "a", "an",
                        "with", "introduction", "advanced", "applied", "fundamentals"}

def _tokenize_subject(s: str) -> set:
    words = s.lower().split()
    tokens = set()
    for w in words:
        w = w.strip("()[].,;:'-")
        w = w.rstrip("s")
        if w and w not in _SUBJECT_STOP_WORDS and len(w) > 2:
            tokens.add(w)
    return tokens

def subjects_overlap(a: str, b: str) -> bool:
    """
    Determines if two subject strings likely refer to the same area, even if phrased differently.
    e.g., "Algorithms" and "Algorithm Design" would overlap, as would "Computer Networks" and "Network Security".
    """
    return bool(_tokenize_subject(a) & _tokenize_subject(b))

def detect_module_tag(title: str, timetable_data: dict) -> Optional[str]:
    """
    Auto-detect a module tag for an uploaded material by scoring word overlap
    between the material title and each unique subject in the user's timetable.
    Returns the best single match, or None if ambiguous or no match found.
    """
    import re
    subject_set: set = set()
    for day_entries in timetable_data.values():
        if not isinstance(day_entries, list):
            continue
        for entry in day_entries:
            subj = entry.get("subject") or entry.get("course") or entry.get("name")
            if subj:
                cleaned = re.sub(
                    r'\b(LAB|LECTURE|LEC|TUTORIAL|TUT|PRACTICAL|PRAC)\b',
                    '', subj, flags=re.IGNORECASE
                ).strip()
                if cleaned:
                    subject_set.add(cleaned)

    scores = {}
    title_tokens = _tokenize_subject(title)
    for subj in subject_set:
        overlap = len(title_tokens & _tokenize_subject(subj))
        if overlap > 0:
            scores[subj] = overlap

    if not scores:
        return None

    max_score = max(scores.values())
    best = [s for s, sc in scores.items() if sc == max_score]
    return best[0] if len(best) == 1 else None

def build_user_context(user_id: str, db: Session) -> str:
    """
    Builds a student profile string to presend to Gemini prompts.
    Returns empty string if no data exists (prompts still work cold).
    """
    from database import UserProfile
    from datetime import timedelta

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()

    # Behavioral signal: study engagement by subject in the last 30 days
    cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    recent_logs = db.query(CompletionLog).filter(
        CompletionLog.user_id == user_id,
        CompletionLog.date >= cutoff
    ).all()

    subject_minutes: dict = {}
    for log in recent_logs:
        tag = log.module_tag
        if tag and tag.strip():
            subject_minutes[tag] = subject_minutes.get(tag, 0) + log.minutes_studied

    # Less than 60 min in 30 days = low engagement / likely struggling or avoiding
    low_engagement = [s for s, m in subject_minutes.items() if m < 60]

    # Current course load from active assignments
    active_assignments = db.query(Assignment).filter(
        Assignment.user_id == user_id,
        Assignment.is_deleted == 0
    ).all()
    current_subjects = list(dict.fromkeys(a.subject for a in active_assignments if a.subject))

    # combine self-reported weak areas with low-engagement subjects
    reported_weak = json.loads(profile.weak_areas or "[]") if profile else []
    all_weak = list(dict.fromkeys(reported_weak + low_engagement))

    lines = []
    if profile:
        if profile.year_of_study:
            lines.append(f"- Year of study: {sanitize_for_prompt(profile.year_of_study, 20)}")
        if profile.degree:
            lines.append(f"- Degree programme: {sanitize_for_prompt(profile.degree, 120)}")

    if current_subjects:
        safe_subjects = [sanitize_for_prompt(s, 80) for s in current_subjects if s]
        lines.append(f"- Current course load: {', '.join(safe_subjects)}")

    if all_weak:
        safe_weak = [sanitize_for_prompt(w, 60) for w in all_weak if w]
        lines.append(
            f"- Weak/low-engagement subjects (match semantically — 'Algorithms' covers "
            f"'Algorithm Analysis', 'Algorithm Design'; 'Networks' covers 'Computer Networks', "
            f"'Network Security'): {', '.join(safe_weak)}"
        )

    if subject_minutes:
        most_studied = max(subject_minutes, key=lambda k: subject_minutes[k])
        total_recent = sum(subject_minutes.values())
        lines.append(
            f"- Recent study focus: {sanitize_for_prompt(most_studied, 60)} "
            f"({subject_minutes[most_studied]} min logged), {total_recent} min total in last 30 days"
        )

    if not lines:
        return ""

    return "STUDENT PROFILE:\n" + "\n".join(lines)

# --- Routes ---

@app.post("/upload-syllabus")
@limiter.limit("5/minute")
async def processSyllabus(request: Request, user_id: str = Depends(verify_token), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Analyzes a syllabus PDF/image and generates a study plan using Gemini.
    Saves to Supabase (via SQLAlchemy).
    """
    try:
        fileName = unquote(file.filename or "Uploaded_syllabus")
        cleanTitle = fileName.rsplit('.', 1)[0].replace('_', ' ')
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
        mime_type = file.content_type or "text/plain"

        today = datetime.now().strftime("%Y-%m-%d")
        user_context = build_user_context(user_id, db)
        profile_block = f"\n{user_context}\n" if user_context else ""
        weak_area_note = (
            "\nPERSONALIZATION DIRECTIVES:\n"
            "- If a student profile is provided above, tailor the week-by-week timeline to their year of study (a 1st year needs more scaffolding; a final year needs precision and efficiency).\n"
            "- If any topics in this syllabus match the student's weak/low-engagement subjects, flag them explicitly in the Time Allocation Breakdown with a [WEAK AREA] tag and increase their suggested hours by at least 30%.\n"
            "- In the Retention Strategy, address the specific subject types this student struggles with — not generic advice.\n"
        ) if user_context else ""

        prompt = f"""
        You are brAInwave, an AI study planning engine built for college students. Analyze this syllabus or study material and produce a structured, actionable study plan in clean Markdown.
        {profile_block}
        TODAY'S DATE: {today}. Use this as the starting point for all timelines and schedules.

        Your output MUST contain exactly these sections in this order:

        ## Course Overview
        2-3 sentences summarizing what this course/material is about, what skills it builds, and what the final assessment looks like.

        ## Key Topics & Concepts
        List every major topic extracted from the syllabus. Group related subtopics under each. Be exhaustive - don't skip anything listed in the document.

        ## Exam Probability Matrix
        Analyze the syllabus to estimate which topics are most likely to appear in assessments. Base your ranking on: how much content the syllabus dedicates to each topic, whether it appears in stated learning outcomes, and whether it's linked to graded assessments or practicals.
        Rank the top 5-7 topics as High / Medium / Lower likelihood. Be explicit about your reasoning.
        Example format: "Graph Algorithms: HIGH — appears in 3 learning outcomes, linked to the final project, and takes up 4 of 12 weeks."

        ## Week-by-Week Study Timeline
        Break the content into a realistic weekly schedule starting from {today} until the end of the course or exam. Each week entry must include:
        - Which topics to cover
        - Suggested hours for that week
        - One specific study method suited to that week's content (e.g., "Use Cornell Notes for Week 1 - heavy theory load")

        ## Time Allocation Breakdown
        For each major topic, estimate total study hours needed and assign a priority level (High / Medium / Low) based on its weight in the course.
        If a topic matches a student weak area (see profile above), flag it with [WEAK AREA] and add 30%+ to the suggested hours.

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
        3-5 evidence-based tips tailored to the content type in this course and this specific student's profile if provided. Focus on long-term retention, not cramming. Be direct and specific - not generic advice.
        {weak_area_note}
        ---
        TONE: Sharp, encouraging, and honest. Write like a top tutor who knows what actually works for busy students.
        FORMATTING: Use Markdown only. No LaTeX. For any math or logic symbols use Unicode (e.g., ∀, ∃, Δ, →, ∑, √).
        LENGTH: Comprehensive but scannable. Use bullet points and sub-bullets, not dense paragraphs.
        """

        studyPlan = call_gemini(
            contents=[
                types.Part.from_text(text=prompt),
                types.Part.from_bytes(data=content, mime_type=mime_type)
            ]
        )

        # Auto-detect module tag from title vs timetable subjects
        detected_module_tag = None
        latest_timetable = db.query(Timetable).filter(
            Timetable.user_id == user_id
        ).order_by(Timetable.created_at.desc()).first()
        if latest_timetable:
            try:
                timetable_data = json.loads(str(latest_timetable.structuredData))
                detected_module_tag = detect_module_tag(cleanTitle, timetable_data)
            except Exception:
                pass

        material = StudyMaterial(
            user_id=user_id,
            title=cleanTitle,
            rawContent=f"Uploaded {fileName}",
            aiPlan=studyPlan,
            file_uri=fileName,
            file_type=mime_type,
            module_tag=detected_module_tag
        )
        db.add(material)
        db.commit()
        db.refresh(material)

        return {"status": "success", "id": material.id, "studyPlan": studyPlan, "module_tag": material.module_tag}

    except Exception as e:
        print(f"Syllabus error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-assignment")
@limiter.limit("5/minute")
async def processAssignment(request: Request, user_id: str = Depends(verify_token), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Extracts metadata from an assignment PDF and generates a master study plan.
    Saves to Supabase.
    """
    try:
        fileName = unquote(file.filename or "Uploaded_assignment")
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
        mime_type = file.content_type or "application/pdf"

        meta_prompt = """
        You are brAInwave, an academic intelligence engine. Analyze this assignment document and extract the following fields as a JSON object:
        - title: A clear, descriptive title for the assignment (not just the filename).
        - subject: The academic subject or course this belongs to (e.g., "Software Engineering", "Macroeconomics").
        - due_date: The submission deadline in YYYY-MM-DD format. ONLY extract this if a date is explicitly written in the document. If no date is found, return null - do NOT guess or infer.
        - due_time: The submission time if explicitly specified (e.g., "23:59", "11:59 PM"). Return null if not found.
        - priority: Assess complexity, weight, and scope. Return one of: 'low', 'medium', or 'high'.
        - estimated_hours: Estimate realistic total hours needed to complete this assignment well. Return an integer between 1 and 40.
        - assignment_type: Classify the work. One of: 'essay', 'report', 'project', 'coding', 'presentation', 'research', 'problem_set', or 'other'.
        - key_requirements: A JSON array of strings, each being one core requirement extracted directly from the document (e.g., ["Minimum 2500 words", "Harvard referencing", "Include UML diagrams"]). Max 6 items.
        - marking_criteria: A JSON array of strings describing how marks are allocated, if stated in the document. Return an empty array if not found.

        Be precise. Do not guess wildly - use only what is in the document.
        """

        meta_data = json.loads(call_gemini(
            config=types.GenerateContentConfig(response_mime_type="application/json"),
            contents=[
                types.Part.from_text(text=meta_prompt),
                types.Part.from_bytes(data=content, mime_type=mime_type)
            ]
        ))

        assignment_type = meta_data.get("assignment_type", "other")
        estimated_hours = meta_data.get("estimated_hours", "unknown")
        due_date = meta_data.get("due_date", "Not specified")
        due_time = meta_data.get("due_time")
        key_requirements = meta_data.get("key_requirements", [])
        marking_criteria = meta_data.get("marking_criteria", [])

        # Deadline conflict detection — check other assignments due within 7 days of this one
        deadline_conflict_block = ""
        if meta_data.get("due_date"):
            try:
                this_due = datetime.strptime(meta_data["due_date"], "%Y-%m-%d")
                today_dt = datetime.now()
                days_remaining = (this_due - today_dt).days
                other_assignments = db.query(Assignment).filter(
                    Assignment.user_id == user_id,
                    Assignment.is_deleted == 0,
                    Assignment.due_date != None
                ).all()
                conflicts = []
                for a in other_assignments:
                    try:
                        other_due = datetime.strptime(a.due_date, "%Y-%m-%d")
                        if abs((other_due - this_due).days) <= 7:
                            delta = (other_due - today_dt).days
                            conflicts.append(f"- {a.title} ({a.subject}) — due in {delta} day(s) ({a.due_date}), priority: {a.priority}")
                    except Exception:
                        pass
                velocity = ""
                if isinstance(estimated_hours, int) and days_remaining > 0:
                    hrs_per_day = round(estimated_hours / days_remaining, 1)
                    flag = " [TIGHT]" if hrs_per_day > 3 else ""
                    velocity = f"\n- Velocity check: {estimated_hours}h needed, {days_remaining} days remaining = {hrs_per_day}h/day required{flag}"
                if conflicts or velocity:
                    deadline_conflict_block = "\n--- DEADLINE CONTEXT ---" + velocity
                    if conflicts:
                        deadline_conflict_block += "\nOther assignments due within 7 days of this one:\n" + "\n".join(conflicts)
                        deadline_conflict_block += "\nADJUST the Time Allocation Guide to account for this competing load. Front-load this assignment if it's higher priority."
            except Exception:
                pass

        # User profile context
        user_context = build_user_context(user_id, db)
        profile_block = f"\n{user_context}\n" if user_context else ""
        weak_area_note = (
            "\nPERSONALIZATION DIRECTIVES:\n"
            "- If the assignment subject matches a student weak area (see profile above), increase estimated effort in the Time Allocation Guide by at least 25% and add a specific note in Red Flags about the most common comprehension gap for this subject.\n"
            "- If a year of study is provided, calibrate your expectations: a 1st year needs more structure and hand-holding; a final year needs efficiency and depth.\n"
        ) if user_context else ""

        guide_prompt = f"""
        You are brAInwave, a specialized academic consultant and assignment strategist. Your job is to produce a detailed, battle-tested Master Plan for this specific assignment.
        {profile_block}
        --- ASSIGNMENT CONTEXT (pre-extracted from the document - use it as your framework, and refer to the document itself for additional detail where needed) ---
        - Type: {assignment_type}
        - Estimated Hours to Complete: {estimated_hours}
        - Due Date: {due_date} {due_time or ""}
        - Key Requirements: {json.dumps(key_requirements)}
        - Marking Criteria: {json.dumps(marking_criteria)}
        {deadline_conflict_block}

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
        Reference any deadline conflicts listed above when sequencing the phases.

        ## 6. Mark-Maximizing Tips
        3-5 specific, high-value tips for THIS assignment type that most students overlook.
        If marking criteria were found, reference them directly. Be blunt about what separates distinction from pass.

        ## 7. Red Flags & Common Mistakes
        Top 3-5 mistakes students make on a {assignment_type} assignment. Be specific - not generic warnings.
        Include how to avoid each one.
        {weak_area_note}
        ---
        TONE: Sharp, direct, and encouraging. Like a tutor who has seen hundreds of students fail and succeed at this exact type of work.
        FORMATTING: Markdown only. No LaTeX. Unicode for any math symbols.
        """

        master_plan = call_gemini(
            contents=[
                types.Part.from_text(text=guide_prompt),
                types.Part.from_bytes(data=content, mime_type=mime_type)
            ]
        )

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
@limiter.limit("60/minute")
async def listAssignments(request: Request, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    assignments = db.query(Assignment).filter(
        Assignment.user_id == user_id,
        Assignment.is_deleted == 0
    ).order_by(Assignment.due_date.asc()).all()
    return {"assignments": assignments}

@app.get("/assignment/{assignment_id}")
@limiter.limit("60/minute")
async def getAssignment(request: Request, assignment_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.user_id == user_id,
        Assignment.is_deleted == 0
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    return assignment

@app.delete("/assignment/{assignment_id}")
@limiter.limit("30/minute")
async def deleteAssignment(request: Request, assignment_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("20/minute")
async def updateAssignmentDueDate(request: Request, assignment_id: int, data: DueDateUpdate, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("5/minute")
async def uploadTimetable(request: Request, user_id: str = Depends(verify_token), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Parses a timetable PDF to extract a weekly class template.
    Saves to Supabase.
    """
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
    prompt = """
        You are brAInwave, a smart study planning assistant for college students.
        Extract the class schedule from this document.
        Return a JSON object with a key 'weekly_template'.
        'weekly_template' must be an object where keys are 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'.
        Each day contains a list of classes with: 'subject', 'time', 'room', 'difficulty', 'duration'.

        CRITICAL INSTRUCTIONS:
        1. Extract the 'time' exactly as it appears in the document (e.g., "10:00 - 11:00"). Do NOT adjust for timezones.
        2. For 'duration': Calculate the EXACT difference between start and end time in minutes. Do NOT round to the nearest hour. Examples: "0800 - 0850" = "50 min", "0800 - 0950" = "110 min", "09:00 - 10:30" = "90 min". Return as "X min" always. If the time range is completely unparseable, default to "50 min".
        3. If a day has no classes, return an empty list for that day.
        4. For 'difficulty': infer from the subject name using these rules:
           - Technical/mathematical subjects (e.g., Engineering, Physics, Calculus, Programming, Networks, Algorithms) → "hard"
           - Mixed/analytical subjects (e.g., Economics, Chemistry, Statistics, Business, Management) → "medium"
           - Humanities/language/social subjects (e.g., History, English, Sociology, Communication, Ethics) → "easy"
           - If unsure, default to "medium".
        5. For 'subject': use the exact course name as it appears in the document. Do not abbreviate or rename.
    """

    timetableData = json.loads(call_gemini(
        config=types.GenerateContentConfig(response_mime_type="application/json"),
        contents=[
            types.Part.from_text(text=prompt),
            types.Part.from_bytes(data=content, mime_type=file.content_type or "application/octet-stream")
        ]
    ))
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
@limiter.limit("60/minute")
async def listTimetables(request: Request, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("30/minute")
async def deleteTimetable(request: Request, timetable_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("20/minute")
async def syncTimetable(request: Request, data: TimetableSync, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("20/minute")
async def syncStudyMaterial(request: Request, data: StudyMaterialSync, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("20/minute")
async def saveDailyPlan(request: Request, data: DailyPlanRequest, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    pass

# --- Module Goal Sync ---

@app.get("/module-goals")
@limiter.limit("60/minute")
async def getModuleGoals(request: Request, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    from database import ModuleGoal
    goals = db.query(ModuleGoal).filter(ModuleGoal.user_id == user_id).all()
    return {"goals": goals}

@app.post("/module-goals")
@limiter.limit("20/minute")
async def syncModuleGoals(request: Request, goals: List[ModuleGoalSync], user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("10/minute")
async def generateDailyPlan(request: Request, plan_data: PlanRequest, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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

        dayOfWeekName = datetime.strptime(plan_data.date, "%Y-%m-%d").strftime("%A")
        todaysClasses = weeklyTemplate.get(dayOfWeekName.lower(), [])
        existing_plan = db.query(DailyPlan).filter(
            DailyPlan.user_id == user_id,
            DailyPlan.date == plan_data.date
        ).first()
        preserved_tasks = []
        if existing_plan:
            existing_items = json.loads(str(existing_plan.items_json))
            preserved_tasks = [i for i in existing_items if i.get("isCustom") is True]

        customTaskList = preserved_tasks + ([t.model_dump() for t in plan_data.customTasks] if plan_data.customTasks else [])

        prefs = {
            "isMorningPerson": plan_data.isMorningPerson,
            "sessionLength": plan_data.preferredSessionLength,
            "mode": plan_data.mode,
            "subjectPriorities": plan_data.subjectPriorities
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
        def extract_material_summary(plan: str) -> str:
            if not plan:
                return "No details"
            # Try to extract the Week-by-Week timeline first 
            # then Key Topics, then Time Allocation
            for marker in ["## Week-by-Week", "## Key Topics", "## Time Allocation"]:
                idx = plan.find(marker)
                if idx != -1:
                    snippet = plan[idx:idx + 1500]
                    cut = snippet.rfind("\n", 0, 1500)
                    return snippet[:cut] if cut > 100 else snippet
            # Fallback: first 1500 chars, cut at last newline
            cut = plan.rfind("\n", 0, 1500)
            return plan[:cut] if cut > 100 else plan[:1500]

        materials_list = [{"title": m.title, "module_tag": m.module_tag, "summary": extract_material_summary(m.aiPlan)} for m in materials]

        generatedItems = await aiOptimization(
            classes=todaysClasses,
            assignments=assignment_list,
            materials=materials_list,
            date=plan_data.date,
            dayOfWeek=dayOfWeekName.capitalize(),
            prefs=prefs,
            customTasks=customTaskList,
            userNote=plan_data.userNote,
            user_id=user_id,
            db=db
        )

        items_json = json.dumps(generatedItems)
        plan = db.query(DailyPlan).filter(
            DailyPlan.user_id == user_id,
            DailyPlan.date == plan_data.date
        ).first()

        if plan:
            plan.items_json = items_json
            plan.generated_at = datetime.now(timezone.utc)
        else:
            plan = DailyPlan(user_id=user_id, date=plan_data.date, items_json=items_json)
            db.add(plan)

        db.commit()

        return {"success": True, "items": generatedItems}

    except Exception as e:
        print(f"Error generating plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def aiOptimization(classes, assignments, materials, date, dayOfWeek, prefs, customTasks=None, userNote=None, user_id=None, db=None):
    from datetime import timedelta

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
    all_known_subjects = list(dict.fromkeys(class_subjects + priorityList + assignment_subjects))

    # --- Behavioral study context from completion logs ---
    behavior_block = ""
    if user_id and db:
        try:
            cutoff_7d = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            week_logs = db.query(CompletionLog).filter(
                CompletionLog.user_id == user_id,
                CompletionLog.date >= cutoff_7d
            ).all()

            weekly_minutes: dict = {}
            for log in week_logs:
                tag = log.module_tag
                if tag and tag.strip():
                    weekly_minutes[tag] = weekly_minutes.get(tag, 0) + log.minutes_studied

            total_weekly = sum(weekly_minutes.values())
            studied_subjects = [f"{s} ({m} min)" for s, m in weekly_minutes.items()]
            # Priority subjects that haven't been touched this week (word-level match)
            unstudied_priorities = [
                s for s in priorityList
                if not any(subjects_overlap(s, k) for k in weekly_minutes)
            ]
            # Check if any priority subject has been completely avoided for 14+ days
            cutoff_14d = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
            long_avoided = []
            for subject in priorityList:
                recent = db.query(CompletionLog).filter(
                    CompletionLog.user_id == user_id,
                    CompletionLog.date >= cutoff_14d,
                    CompletionLog.module_tag.ilike(f"%{subject}%")
                ).first()
                if not recent:
                    long_avoided.append(subject)

            behavior_block = f"""
        --- STUDY BEHAVIOR (last 7 days from completion logs) ---
        - Total study time logged this week: {total_weekly} minutes
        - Subjects studied this week: {', '.join(studied_subjects) if studied_subjects else "None logged yet"}
        - Priority subjects NOT studied this week: {', '.join(unstudied_priorities) if unstudied_priorities else "None — good coverage this week"}
        - Subjects not studied in 14+ days (avoidance signal): {', '.join(long_avoided) if long_avoided else "None detected"}
        BEHAVIORAL DIRECTIVES:
        - Any subject not studied this week that is in the priority list MUST appear in today's plan.
        - If a subject hasn't been studied in 14+ days, add a 15-20 min "re-entry" warm-up block before the main study block for that subject. Label it as "Review & Restart: [subject]" to reduce re-entry friction.
        - Do NOT schedule brain breaks immediately after re-entry blocks — the student needs momentum first.
"""
        except Exception:
            behavior_block = ""

    prompt = f"""
        You are brAInwave, a professional AI Study Architect. Your goal is to build a high-performance daily schedule tailored to a student's specific cognitive profile, academic load, and actual study history.

        SCHEDULE DATE: {dayOfWeek}, {date}

        --- USER COGNITIVE PROFILE ---
        - Energy Peak: {"MORNING - schedule Hard/high-priority study blocks before 12:00 PM" if prefs.get('isMorningPerson') else "EVENING - schedule Hard/high-priority study blocks after 4:00 PM"}
        - Preferred Study Block Length: {targetRange} minutes
        - Goal Mode: {prefs.get('mode', 'stay_consistent').replace('_', ' ')}
        - Subject Priorities (index 0 = highest priority): {priorityContext}
        {behavior_block}

        --- DATA INPUTS ---
        - Today's Classes: {json.dumps(classes)}
        - Pending Assignments (title, due_date, priority): {json.dumps(assignments)}
        - Study Materials Context (Syllabus Snippets with module tags): {materialsContext}
            SYLLABUS ALIGNMENT (MANDATORY): Each material entry has a "module_tag" field. When scheduling a study block for a class, check if any material's module_tag matches that class's subject. If a match exists, the task description MUST reference specific topics, weeks, or concepts from that material's summary — not a generic "Study [subject]" instruction. Example: if module_tag="Digital Signal Processing" matches a class subject, write "Review Week 3: Fourier Transform derivations (from syllabus)" not "Study Digital Signal Processing".
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
           - SESSION LENGTH (HARD RULE): Every study block MUST be between {targetRange} minutes. Never schedule a study block shorter or longer than this range. This applies to ALL study blocks, not just priority subjects.
           - PILLAR 1 (Priority): Subjects at index 0-1 in Subject Priorities get blocks scheduled during the Energy Peak window.
           - PILLAR 2 (Urgency): Any assignment due within 48 hours from {date} MUST be scheduled, overriding all other priorities.
           - PILLAR 3 (Mode):
             * 'exam prep' → 70% of free gaps go to active recall / practice questions for top priority subject
             * 'catch up' → Dedicate multiple consecutive blocks to the single most overdue subject
             * 'stay consistent' → Rotate across 2-3 different subjects to maintain momentum
        5. HEALTH RULES (MANDATORY — violating these is a critical failure):
           - No study blocks between 11:00 PM and 7:00 AM.
           - Insert a 10-minute Brain Break after EVERY study block, no exceptions. A study block immediately followed by another study block with no break in between is a scheduling error.
           - Leave at least 90 minutes of total unscheduled time across the day (not counting class blocks or fixed tasks). Do NOT fill every free gap — the student needs time for meals, transit, and mental recovery. If the day is packed with classes, schedule fewer study blocks, not more.
           - Never schedule more than 3 study blocks total if the student already has 4 or more class blocks in the day.
        6. TASK DESCRIPTIONS: Each task's "task" field must be a specific, actionable instruction - not vague (e.g., "Complete Introduction section draft for Research Paper" not "Study Research Paper").

        --- OUTPUT FORMAT ---
        Return a JSON object with a single key "items" containing an array. Each item MUST follow this exact schema:
        {{
            "time": "HH:MM AM/PM",
            "subject": "Exact name from Canonical Subject Names list",
            "task": "Specific actionable instruction",
            "duration": "X min",
            "completed": false,
            "difficulty": "easy" | "medium" | "hard",
            "isCustom": false,
            "module_tag": "module name from materials list, or null if no match"
        }}
        For each study block, set "module_tag" to the "module_tag" value from the matching material entry in the materials list. If no material matches the subject, set "module_tag" to null.
        For class blocks, set "task" to "Class Lecture", use the subject name exactly as it appears in Today's Classes, and set "module_tag" to the class subject name.
        For brain breaks, set "subject" to "Break", "difficulty" to "easy", "isCustom" to false, "module_tag" to null.
    """
    result = json.loads(call_gemini(
        config=types.GenerateContentConfig(response_mime_type="application/json"),
        contents=[prompt]
    ))
    items = result.get("items", [])
    for item in items:
        item["id"] = str(uuid.uuid4())
    return items

@app.get("/daily-plans")
@limiter.limit("60/minute")
async def listDailyPlans(request: Request, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("30/minute")
async def syncCompletionLogs(
    request: Request,
    logs: List[CompletionLogEntry],
    user_id: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    # Migrate any old NULL module_tag rows to '' for consistency with client
    db.execute(text("UPDATE completion_logs SET module_tag = '' WHERE module_tag IS NULL"))

    for entry in logs:
        tag = entry.module_tag if entry.module_tag is not None else ''
        existing = db.query(CompletionLog).filter(
            CompletionLog.user_id == user_id,
            CompletionLog.date == entry.date,
            CompletionLog.module_tag == tag
        ).first()

        if existing:
            existing.minutes_studied = entry.minutes_studied # replace, not increment
        else:
            db.add(CompletionLog(
                user_id=user_id,
                date=entry.date,
                minutes_studied=entry.minutes_studied,
                module_tag=tag,
            ))
    db.commit()
    return {"status": "success"}

@app.get("/completion-logs")
@limiter.limit("60/minute")
async def getCompletionLogs(request: Request, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    logs = db.query(CompletionLog).filter(CompletionLog.user_id == user_id).all()
    return {"logs": [{"date": l.date, "minutes_studied": l.minutes_studied, "module_tag": l.module_tag} for l in logs]}

@app.get("/study-plan/{material_id}")
@limiter.limit("60/minute")
async def getStudyMaterial(request: Request, material_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(
        StudyMaterial.id == material_id,
        StudyMaterial.user_id == user_id,
        StudyMaterial.is_deleted == 0
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study plan not found.")
    return {"id": material.id, "title": material.title, "aiPlan": material.aiPlan, "createdAt": material.created_at, "module_tag": material.module_tag}

@app.get("/study-plans")
@limiter.limit("60/minute")
async def listStudyPlans(request: Request, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    materials = db.query(StudyMaterial).filter(
        StudyMaterial.user_id == user_id,
        StudyMaterial.is_deleted == 0
    ).order_by(StudyMaterial.created_at.desc()).all()
    return {"count": len(materials), "plans": [{"id": m.id, "title": m.title, "createdAt": m.created_at, "module_tag": m.module_tag} for m in materials]}

@app.get("/daily-plan/{date}")
@limiter.limit("60/minute")
async def getDailyPlan(request: Request, date: str, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("30/minute")
async def deleteStudyMaterial(request: Request, material_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(
        StudyMaterial.id == material_id,
        StudyMaterial.user_id == user_id
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study plan not found.")

    db.delete(material)
    db.commit()
    return {"status": "success"}

@app.patch("/study-material/{material_id}/module-tag")
@limiter.limit("30/minute")
async def updateMaterialModuleTag(request: Request, material_id: int, body: ModuleTagUpdate, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(
        StudyMaterial.id == material_id,
        StudyMaterial.user_id == user_id,
        StudyMaterial.is_deleted == 0
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study material not found.")
    material.module_tag = body.module_tag
    db.commit()
    return {"status": "success", "module_tag": material.module_tag}

@app.get("/profile")
@limiter.limit("60/minute")
async def getProfile(request: Request, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    from database import UserProfile
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        return {"year_of_study": None, "degree": None, "weak_areas": []}
    return {
        "year_of_study": profile.year_of_study,
        "degree": profile.degree,
        "weak_areas": json.loads(profile.weak_areas or "[]")
    }

@app.post("/profile")
@limiter.limit("10/minute")
async def saveProfile(request: Request, data: UserProfileSchema, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    from database import UserProfile
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile:
        profile.year_of_study = data.year_of_study
        profile.degree = data.degree
        profile.weak_areas = json.dumps(data.weak_areas or [])
        profile.updated_at = datetime.now(timezone.utc)
    else:
        db.add(UserProfile(
            user_id=user_id,
            year_of_study=data.year_of_study,
            degree=data.degree,
            weak_areas=json.dumps(data.weak_areas or [])
        ))
    db.commit()
    return {"status": "success"}

@app.post("/generate-flashcards")
@limiter.limit("10/minute")
async def generateFlashcards(request: Request, material_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
        content_length = len(material.aiPlan or "") + len(material.rawContent or "")
        card_count = 10 if content_length > 3000 else 7 if content_length > 1500 else 5

        # Build content block: prefer original source, supplement with AI study plan
        raw = (material.rawContent or "").strip()
        plan = (material.aiPlan or "").strip()
        if raw and plan:
            combined_content = f"ORIGINAL CONTENT:\n{raw}\n\nAI STUDY PLAN (supplementary):\n{plan}"
        elif plan:
            combined_content = f"AI STUDY PLAN:\n{plan}"
        else:
            combined_content = f"ORIGINAL CONTENT:\n{raw}"

        # Check if this subject is a known weak area to adjust difficulty distribution
        user_context = build_user_context(user_id, db)
        profile_block = f"\n{user_context}\n" if user_context else ""

        # Detect weak area match by checking profile weak_areas against material title
        is_weak_area = False
        if user_context:
            from database import UserProfile
            from datetime import timedelta
            profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
            reported_weak = json.loads(profile.weak_areas or "[]") if profile else []
            cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            low_logs = db.query(CompletionLog).filter(
                CompletionLog.user_id == user_id,
                CompletionLog.date >= cutoff
            ).all()
            low_subjects = [l.module_tag for l in low_logs if l.module_tag and l.minutes_studied < 60]
            all_weak = reported_weak + low_subjects
            # Use word-level semantic overlap instead of substring matching.
            # "Algorithms" correctly matches "Algorithm Analysis" and "Graph Algorithms"
            # but does NOT incorrectly match "Data Structures".
            is_weak_area = any(subjects_overlap(w, material.title) for w in all_weak)

        if is_weak_area:
            difficulty_instruction = (
                "DIFFICULTY DISTRIBUTION (WEAK AREA MODE): This subject is flagged as a weak area for this student. "
                "Skew difficulty toward medium and hard — approximately 15% easy, 45% medium, 40% hard. "
                "Prioritize foundational concept cards that address common misconceptions before advanced application. "
                "Easy cards should still test genuine understanding, not just surface recall."
            )
        else:
            difficulty_instruction = "Distribute difficulty evenly: approximately 1/3 easy, 1/3 medium, 1/3 hard."

        prompt = f"""
        You are brAInwave, a study assistant specializing in active recall techniques. Generate a set of high-quality flashcards from the study material below.
        {profile_block}
        MATERIAL TITLE: {material.title}
        SUBJECT TYPE: {subject_type}
        CARD STYLE DIRECTIVE: {card_style}

        CONTENT:
        {combined_content}

        INSTRUCTIONS:
        1. Generate exactly {card_count} flashcards. No more, no less.
        2. {difficulty_instruction}
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

        cards = json.loads(call_gemini(
            config=types.GenerateContentConfig(response_mime_type="application/json"),
            contents=[prompt]
        )).get("flashcards", [])

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
@limiter.limit("60/minute")
async def getFlashcards(request: Request, material_id: int, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    cards = db.query(Flashcard).filter(
        Flashcard.user_id == user_id,
        Flashcard.material_id == material_id
    ).all()
    return {"status": "success", "flashcards": cards}

@app.delete("/daily-plan/{date}/{task_id}")
@limiter.limit("30/minute")
async def deleteDailyTask(request: Request, date: str, task_id: str, user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
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
@limiter.limit("60/minute")
def readRoot(request: Request):
    return {"message": "brAInwave API running", "version": "1.0.0"}

@app.get("/health")
@limiter.limit("60/minute")
def healthCheck(request: Request):
    return {"status": "ok"}