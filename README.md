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

- **Personalized Study Plans** - brAInwave learns your schedule, preferences, and goals to generate a realistic plan that fits your life, not the other way around.
- **Intelligent Gap Analysis** - Unlike general-purpose AI tools, brAInwave queries your fixed timetable to find actual open windows, not just suggest arbitrary time slots.
- **Offline-First Knowledge Vault** - All processed documents and study plans are stored locally. You can interact with your roadmap and export to PDF with no internet connection.
- **Integrated Deep Work Timer (Pomodoro)** - Transition from planning to execution without leaving the app. Focus sessions are tracked locally and synced to the cloud.
- **Contextual Push Notifications** - Native alerts tied to your daily schedule remind you when a study block is coming up, so your plan stays actionable.
- **Custom Task Support** - Add your own tasks alongside AI-generated ones. The engine incorporates them into the optimization process.
- **Production-Grade Document Export** - Export study plans as polished PDFs with high-fidelity formatting.

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

1. **Local Execution** - All user actions (uploading a syllabus, checking off a task) are first committed to the local SQLite database.
2. **State Tracking** - Rows are marked with an `is_dirty` flag and assigned a temporary local UUID.
3. **Cloud Reconciliation** - A background sync service pushes dirty records to the FastAPI backend. On a successful commit to Supabase, the backend returns a production `remote_id`.
4. **Conflict Resolution** - The client updates local records with the `remote_id` and clears the `is_dirty` flag, ensuring consistency without duplicates.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI with `expo-dev-client` (this project requires a development build, not Expo Go)
- Python 3.10+ for the backend
- A Railway account for backend hosting
- A Supabase project for the cloud database
- A Gemini API key
- A Firebase project for Google authentication (a Google Cloud project is created automatically alongside it)
- OAuth 2.0 credentials configured in Google Cloud (Android, iOS and Web clients)

### 1. Clone the repository

```bash
git clone https://github.com/loag0/brAInwave.git
cd brainwave 
#or cd backend
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

## Google Authentication Setup

brAInwave uses Google Sign-in via Firebase Authentication. This is one of the more involved parts of the setup because it requires coordinating credentials across three places: Google Cloud, Firebase and EAS. Getting any one of them out of sync will break auth silently

### Overview
Google Sign-In requires a separate `OAuth 2.0 Client` for each platform (Android, iOS, Web). Each client ID tells Google which app is allowed to initiate the sign-in flow. Firebase acts as the auth middleware between your app and Google.

### Step 1 - Enable Google as a sign-in provider
1. Go to your firebase console
2. Find and enable **Google** under **Authentication > Sign-in method**.
3. Register an app for each platform you intend to support under **Project Settings > Your apps**.

### Step 2 - Generate your SHA certificate fingerprints (Android only)
Android Google Sign-In requires your app's SHA-1 (and optionally SHA-256) fingerprint to be registered in both Firebase and Google Cloud. You need two fingerprints: one for local development and one for production EAS builds.

**Local / debug fingerprint:**
```bash
npx expo run:android
# Then check the terminal output for the debug keystore SHA-1, or run:
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Production fingerprint (EAS managed keystore):**
```bash
eas credentials --platform android
# Select your build profile and choose "Set up a new keystore" or view existing
# EAS will display the SHA-1 and SHA-256 fingerprints for the managed keystore
```

Add both fingerprints to your Firebase Android app under **Project Settings > Your apps > Android app > Add fingerprint**.

### Step 3 - Configure Google Cloud OAuth clients
Firebase automatically creates some OAuth clients, but you need to verify and configure them manually in the [Google Cloud Console](https://console.cloud.google.com/) under **APIs and Services > Credentials**.

Create or confirm the following clients exist:

| Client Type | Used For | Notes |
| :--- | :--- | :--- |
| **Android** | Native Android Sign-In | Requires package name + SHA-1 fingerprint. Create one for debug and one for production. |
| **iOS** | Native iOS Sign-In | Requires your iOS bundle identifier (e.g., `com.username.project_name`) |
| **Web** | Firebase Auth backend + web builds | Used internally by Firebase; also required for Expo web target |

> The Web client ID is what gets passed as `webClientId` in your app's Google Sign-In configuration. Do not use the Android or iOS client IDs here (ask me how I know lol).

### Step 4 - Configure EAS credentials
EAS Build needs to use the same keystore that generated the SHA fingerprint you registered in Firebase. If EAS generates a new keystore at build time, the fingerprint won't match and Google Sign-In will fail in production

```bash
#Lock in your credentials before building
eas credentials --platform android
```

Select your production profile and confirm EAS is using the managed keystore whose SHA fingerprint is already registered. Do not let EAS auto-generate a new one mid-project.

For iOS, EAS handles provisioning profiles and certificates. Ensure the bundle identifier in `app.json` matches the one registered in your Firebase iOS app exactly.

### Step 5 - Environment variables

Add the following to your `/brainwave/.env` (and to the Expo Dashboard for EAS builds):

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=       # Web client ID from Google Cloud Console
EXPO_PUBLIC_FIREBASE_API_KEY=           # From Firebase project settings
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=       # e.g., your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=        # Your Firebase project ID
EXPO_PUBLIC_FIREBASE_APP_ID=            # From Firebase project settings
```

### Common failure points

- **NEVER EVER use Expo Go** - If you're testing Google auth locally, always use a dev build otherwise it won't work (ask me how I know).
- **Sign-in works in dev but fails in production** - The EAS production keystore SHA fingerprint is not registered in Firebase or Google Cloud. Run `eas credentials` and cross-check.
- **iOS Sign-In fails** - The bundle identifier in `app.json` does not match the one in the Firebase iOS app registration.
- **`DEVELOPER_ERROR` on Android** - Almost always a SHA fingerprint mismatch. Double-check both the debug and production fingerprints are registered.
- **Web client ID missing** - Passing the Android client ID as `webClientId` instead of the Web client ID will cause auth to fail on all platforms.

---

## Environment & DevOps

### Backend - Railway

The backend is hosted on Railway with a dedicated static URL. This eliminates the need for tunneling and ensures reliable API communication in production builds.

### Mobile - Expo / EAS

Development builds are required due to native configurations and the modern `expo-file-system` API. Standard Expo Go will not work.

---

## Project Status

brAInwave is in active development. Core features such as study plan generation, timetable/syllabus upload, document export, and the Pomodoro timer are functional. Cross-device sync via Supabase and final production polish are in progress.

---

## License

To be added.
