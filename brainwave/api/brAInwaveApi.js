import axios from "axios";
import { auth } from "../firebaseConfig";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Attach Firebase ID token to every request automatically
axios.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        // forceRefresh=false uses cached token, avoids delay on every request
        const token = await user.getIdToken(false);
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error getting auth token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axios.defaults.timeout = 30000; // 30 seconds

class BrAInwaveAPI {
  /**
   * Uploads a timetable PDF/image to the backend for parsing.
   * Matching Endpoint: POST /upload-timetable
   */
  async uploadTimetable(userId, fileUri, fileName, fileType) {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: fileType || "application/pdf",
    });

    const response = await axios.post(
      `${API_BASE_URL}/upload-timetable`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000, // file uploads get longer timeout
      },
    );
    return response.data;
  }

  /**
   * Uploads a syllabus PDF/image to generate a study plan.
   * Matching Endpoint: POST /upload-syllabus
   */
  async uploadSyllabus(userId, fileUri, fileName, fileType) {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName || "file.pdf",
      type: fileType || "application/pdf",
    });

    const response = await axios.post(
      `${API_BASE_URL}/upload-syllabus`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000, // In case Gemini takes a while to parse and generate the plan
      },
    );
    return response.data;
  }

  /**
   * Uploads an assignment PDF to extract metadata and generate a study guide.
   * Matching Endpoint: POST /upload-assignment
   */
  async uploadAssignment(userId, fileUri, fileName, fileType) {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName || "assignment.pdf",
      type: fileType || "application/pdf",
    });

    const response = await axios.post(
      `${API_BASE_URL}/upload-assignment`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      },
    );
    return response.data;
  }

  /**
   * Syncs a text-only study material (no file) to Supabase.
   * Matching Endpoint: POST /study-materials
   * Used in: syncDirtyRecords for materials without a file attachment
   */
  async createMaterial(userId, { title, rawContent }) {
    const response = await axios.post(`${API_BASE_URL}/study-materials`, {
      title,
      rawContent,
      aiPlan: "",
    });
    return response.data;
  }

  /**
   * Deletes a study material from Supabase.
   * Matching Endpoint: DELETE /study-plan/{materialId}
   */
  async deleteMaterial(userId, materialId) {
    const response = await axios.delete(
      `${API_BASE_URL}/study-plan/${materialId}`,
    );
    return response.data;
  }

  /**
   * Syncs a local timetable to Supabase.
   * Matching Endpoint: POST /timetables
   */
  async syncTimetable(userId, title, structuredData) {
    const response = await axios.post(`${API_BASE_URL}/timetables`, {
      title,
      structuredData,
    });
    return response.data;
  }

  async listAssignments(userId) {
    const response = await axios.get(`${API_BASE_URL}/assignments`);
    return response.data;
  }

  async getAssignment(userId, assignmentId) {
    const response = await axios.get(
      `${API_BASE_URL}/assignment/${assignmentId}`,
    );
    return response.data;
  }

  async updateAssignmentDueDate(remoteId, newDueDate, newDueTime) {
    const response = await axios.patch(
      `${API_BASE_URL}/assignment/${remoteId}/due-date`,
      { due_date: newDueDate, due_time: newDueTime },
    );
    return response.data;
  }

  async deleteAssignment(userId, assignmentId) {
    const response = await axios.delete(
      `${API_BASE_URL}/assignment/${assignmentId}`,
    );
    return response.data;
  }

  async listTimetables(userId) {
    const response = await axios.get(`${API_BASE_URL}/timetables`);
    return response.data;
  }

  async deleteTimetable(userId, timetableId) {
    const response = await axios.delete(
      `${API_BASE_URL}/timetable/${timetableId}`,
    );
    return response.data;
  }

  async listStudyPlans(userId) {
    const response = await axios.get(`${API_BASE_URL}/study-plans`);
    return response.data;
  }

  async getStudyPlanDetails(userId, planId) {
    const response = await axios.get(`${API_BASE_URL}/study-plan/${planId}`);
    return response.data;
  }

  async generateDailyPlan(
    userId,
    date,
    preferences,
    customTasks = [],
    userNote,
  ) {
    const body = {
      date,
      isMorningPerson: preferences.isMorningPerson === true,
      preferredSessionLength: preferences.preferredSessionLength || "medium",
      mode: preferences.mode || "stay_consistent",
      subjectPriorities: preferences.subjectPriorities || [],
      customTasks: customTasks || [],
    };
    if (userNote && typeof userNote === "string" && userNote.trim())
      body.userNote = userNote;

    const response = await axios.post(
      `${API_BASE_URL}/generate-plan`,
      body,
      { timeout: 60000 }, // in case Gemini takes a while to respond with a plan
    );
    return response.data;
  }

  async saveDailyPlan(userId, date, items) {
    const response = await axios.post(`${API_BASE_URL}/daily-plan`, {
      date,
      items,
    });
    return response.data;
  }

  async listDailyPlans(userId) {
    const response = await axios.get(`${API_BASE_URL}/daily-plans`);
    return response.data;
  }

  async syncCompletionLogs(logs) {
    const response = await axios.post(`${API_BASE_URL}/completion-logs`, logs);
    return response.data;
  }

  async generateFlashcards(userId, materialId) {
    const response = await axios.post(
      `${API_BASE_URL}/generate-flashcards`,
      null,
      {
        params: { material_id: materialId },
        timeout: 60000,
      },
    );
    return response.data;
  }

  async getFlashcards(userId, materialId) {
    const response = await axios.get(
      `${API_BASE_URL}/flashcards/${materialId}`,
    );
    return response.data;
  }

  async deleteTask(userId, date, taskId) {
    const response = await axios.delete(
      `${API_BASE_URL}/daily-plan/${date}/${taskId}`,
    );
    return response.data;
  }
}

export default new BrAInwaveAPI();
