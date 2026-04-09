# brAInwave: Intelligent Study Architect

**An Offline-First, AI-Driven Academic Planning System**

---

## What is brAInwave?

brAInwave is a mobile application that transforms your syllabi and class schedules into a dynamic, conflict-aware study roadmap. It learns your timetable, identifies open study windows, and generates a personalized plan that helps you retain knowledge, not just survive the next exam.

Built for college students who are juggling multiple courses, unpredictable schedules, and limited time.

---

## The Problem

Most students don't fail because they're not smart, they fail because they're disorganized. Scattered notes, no structured plan, and a habit of cramming the night before an exam. Static tools like calendar apps and to-do lists don't understand a student's workload. They just remind you that you're behind.

**brAInwave** is built to fix that.

---

## Key Features

- **Personalized Study Plans** - brAInwave learns your schedule, preferences, and goals to generate a realistic plan that fits your life, not the other way around. Powered by Gemini 3.0 Flash with multimodal PDF parsing in a single pass.
- **Intelligent Gap Analysis** - Unlike general-purpose AI tools, brAInwave queries your fixed timetable to find actual open windows, not just suggest arbitrary time slots.
- **Offline-First Knowledge Vault** - All processed documents and study plans are stored locally in SQLite. You can interact with your roadmap and export to PDF with no internet connection.
- **Integrated Deep Work Timer (Pomodoro)** - Transition from planning to execution without leaving the app. Focus sessions are tracked locally and synced to Supabase — works fully offline.
- **Contextual Push Notifications** - Native alerts tied to your actual timetable gaps remind you when a study block is coming up. Not arbitrary reminders — reminders that know your schedule.
- **Custom Task Support** - Add your own tasks alongside AI-generated ones. The engine incorporates them into the optimization process.
- **Production-Grade Document Export** - Export study plans as polished PDFs. On Android, files save directly to your chosen folder via the Storage Access Framework; on iOS, via the native share sheet.

---

## Core User Flow

1. **Sign in** with Google via Firebase Authentication
2. **Set up your timetable** — enter your fixed weekly class schedule so the app knows your unavailable windows
3. **Upload a syllabus PDF** — brAInwave sends it to the backend where Gemini parses it and extracts topics, deadlines, and weightings
4. **AI generates your study plan** — a conflict-aware roadmap is built around your open windows and returned as structured tasks
5. **Study plan lands in your Library** — tasks are surfaced on the Home screen, ordered by priority and due date
6. **Start a Pomodoro session** — tap any task to begin a focus block; sessions are logged locally and synced to the cloud
7. **Push notifications** fire before upcoming study blocks based on your timetable
8. **Export to PDF** — download a formatted version of your study plan directly to your device
9. **Go offline** — all data remains accessible; any changes are flagged and synced automatically when you're back online

---

## System Architecture

The application is built on a distributed architecture that prioritizes local performance while ensuring global data persistence.

| Component | Technology | Why |
| :--- | :--- | :--- |
| **Mobile Client** | React Native (Expo) | Cross-platform support with access to native device APIs via the New Expo FileSystem API |
| **Local Persistence** | SQLite (`expo-sqlite`) | Primary data layer for offline-first capabilities and zero-latency access |
| **Backend API** | FastAPI (Python) | High-performance async API; hosted on Railway for a stable, static URL without tunneling |
| **Cloud Database** | Supabase (PostgreSQL) | Centralized source of truth for cross-device synchronization |
| **AI Orchestration** | Gemini 3.0 Flash | Chosen for its multimodal capabilities: handles PDF parsing and structured schedule optimization in a single pass |

---

## Data Integrity & Synchronization

brAInwave uses a **Write-Ahead Sync (Dirty Flag)** pattern to ensure seamless operation in low-connectivity environments like libraries or commutes.

1. **Local Execution** - All user actions are first committed to the local SQLite database
2. **State Tracking** - Rows are marked with an `is_dirty` flag and assigned a temporary local UUID
3. **Cloud Reconciliation** - A background sync service pushes dirty records to the FastAPI backend; on success, the backend returns a production `remote_id`
4. **Conflict Resolution** - The client updates local records with the `remote_id` and clears the `is_dirty` flag, ensuring consistency without duplicates

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI with `expo-dev-client` (this project requires a development build, not Expo Go)
- Python 3.10+ for the backend
- A Railway account for backend hosting
- A Supabase project for the cloud database
- A Gemini API key
- A Firebase project for Google authentication

### 1. Clone the repository

```bash
git clone https://github.com/loag0/brAInwave.git
cd brainwave
```

### 2. Configure the backend (`/backend`)

Set the following environment variables in your Railway dashboard (or in a local `backend/.env` for development):

```env
DATABASE_URL= #PostgreSQL connection string (from Supabase)
GEMINI_API_KEY= #API key for AI orchestration
FIREBASE_SERVICE_ACCOUNT= #JSON string for Firebase Admin SDK
```

> Example `.env` structure is included in the `/backend` folder.

### 3. Configure the mobile app (`/brainwave`)

Environment variables use the `EXPO_PUBLIC_` prefix.

- **Local development:** Create a `.env` file in `/brainwave`
- **Production (EAS):** Set variables in the Expo Dashboard under Secret Environment Variables

> Example `.env` structure is included in the `/brainwave` folder.

> Google Sign-In is configured via Firebase.

### 4. Run the app

```bash
# Development build (required - Expo Go is not supported)
npx expo run:android
# or
npx expo run:ios

# Production build
eas build --platform android --profile production
```

---

## Environment & DevOps

### Backend - Railway

The backend is hosted on Railway with a dedicated static URL. This eliminates the need for tunneling and ensures reliable API communication in production builds.

### Mobile - Expo / EAS

Development builds are required due to native configurations and the modern `expo-file-system` API. Standard Expo Go will not work.

---

## Project Status

| Feature | Status |
| :--- | :--- |
| Study plan generation (AI) | Complete |
| Timetable / syllabus upload | Complete |
| Offline-first local storage | Complete |
| Pomodoro focus timer | Complete |
| PDF export (iOS + Android) | Complete |
| Push notifications | Complete |
| Cross-device sync (Supabase) | Complete |
| Google Sign-In | Complete |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
