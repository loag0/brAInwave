import axios from "axios";
import { auth } from "../firebaseConfig";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Attach Firebase ID token to every request automatically
axios.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error getting auth token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axios.defaults.timeout = 20000; // 20 seconds timeout for all requests

const checkConnection = async () => {
  console.log(`Checking connection to: ${API_BASE_URL}`);
  try {
    const response = await fetch(API_BASE_URL);
    if (response.ok) {
      console.log("Server is LIVE and reachable!");
    } else {
      console.warn(`Server responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error("Server is DOWN or unreachable:", error.message);
  }
};

checkConnection();

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
        timeout: 60000, // 60 seconds timeout for file uploads
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
        timeout: 60000,
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
   * Used in: syncDirtyRecords, deleteMaterial
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

  async getStudyPlan(userId, planId) {
    const response = await axios.get(`${API_BASE_URL}/study-plan/${planId}`);
    return response.data;
  }

  async deleteStudyPlan(userId, planId) {
    const response = await axios.delete(`${API_BASE_URL}/study-plan/${planId}`);
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
      isMorningPerson: preferences.isMorningPerson,
      preferredSessionLength: preferences.preferredSessionLength,
      mode: preferences.mode,
      subjectPriorities: preferences.subjectPriorities,
      customTasks,
    };
    if (userNote) body.userNote = userNote;

    const response = await axios.post(
      `${API_BASE_URL}/generate-plan`, body,
      { timeout: 60000 } // in case ai generation takes longer
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

  async getDailyPlan(userId, date) {
    try {
      const response = await axios.get(`${API_BASE_URL}/daily-plan/${date}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching daily plan for ${date}:`, error.message);
      return null;
    }
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

  async checkHealth() {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  }
}

export default new BrAInwaveAPI();
