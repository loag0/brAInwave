import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

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
      type: fileType,
    });

    const response = await axios.post(
      `${API_BASE_URL}/upload-timetable?user_id=${userId}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
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

    try {
      const response = await axios({
        method: "post",
        url: `${API_BASE_URL}/upload-syllabus`,
        params: { user_id: userId },
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
          Accept: "application/json",
        },
        transformRequest: (data) => data,
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        console.log("Server Error Data:", error.response.data);
      }
      throw error;
    }
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

    try {
      const response = await axios({
        method: "post",
        url: `${API_BASE_URL}/upload-assignment`,
        params: { user_id: userId },
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
          Accept: "application/json",
        },
        transformRequest: (data) => data,
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        console.log("Assignment Upload Error:", error.response.data);
      }
      throw error;
    }
  }

  /**
   * Creates a text-only study material (no file).
   * Matching Endpoint: POST /study-material
   * Used in: syncDirtyRecords (text-only fallback)
   */
  async createMaterial(userId, { title, rawContent }) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/study-material`,
        { title, rawContent },
        {
          params: { user_id: userId },
          headers: { "Content-Type": "application/json" },
        },
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create material: ${error.message}`);
    }
  }

  /**
   * Deletes a specific study material.
   * Matching Endpoint: DELETE /study-material/{userId}/{materialId}
   * Used in: syncDirtyRecords, deleteMaterial
   */
  async deleteMaterial(userId, materialId) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/study-material/${userId}/${materialId}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete material: ${error.message}`);
    }
  }

  async getStudyPlan(userId, planId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/study-plan/${userId}/${planId}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get study plan: ${error.message}`);
    }
  }

  async listStudyPlans(userId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/study-plans/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to list study plans: ${error.message}`);
    }
  }

  async listDailyPlans(userId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/daily-plans/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.detail || "Failed to fetch daily plans",
      );
    }
  }

  /**
   * Saves a generated daily plan to the backend.
   * Matching Endpoint: POST /daily-plan
   * Used in: generatePlanForDate (immediate push after AI generation)
   */
  async saveDailyPlan(userId, date, items) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/daily-plan`,
        { user_id: userId, date, items },
        { headers: { "Content-Type": "application/json" } },
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to save daily plan: ${error.message}`);
    }
  }

  async listTimetables(userId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/timetables/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to list timetables: ${error.message}`);
    }
  }

  async deleteTimetable(userId, timetableId) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/timetable/${userId}/${timetableId}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete timetable: ${error.message}`);
    }
  }

  async getAssignment(userId, assignmentId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/assignment/${userId}/${assignmentId}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get assignment: ${error.message}`);
    }
  }

  async listAssignments(userId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/assignments/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to list assignments: ${error.message}`);
    }
  }

  async deleteAssignment(userId, assignmentId) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/assignment/${userId}/${assignmentId}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete assignment: ${error.message}`);
    }
  }

  async deleteStudyPlan(userId, planId) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/study-plan/${userId}/${planId}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete study plan: ${error.message}`);
    }
  }

  async deleteTask(userId, date, taskId) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/daily-plan/${userId}/${date}/${taskId}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  }

  async generateDailyPlan(
    userId,
    date,
    preferences,
    customTasks = [],
    userNote,
  ) {
    try {
      const body = {
        user_id: userId,
        date,
        isMorningPerson: preferences.isMorningPerson,
        preferredSessionLength: preferences.preferredSessionLength,
        mode: preferences.mode,
        subjectPriorities: preferences.subjectPriorities,
        customTasks,
      };
      if (userNote) body.userNote = userNote;

      const response = await axios.post(`${API_BASE_URL}/generate-plan`, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 45000,
      });
      return response.data;
    } catch (error) {
      console.error(
        "Error in generateDailyPlan: ",
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.detail ||
          `Failed to generate daily plan: ${error.message}`,
      );
    }
  }

  async getDailyPlan(userId, date) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/daily-plan/${userId}/${date}`,
      );
      return response.data;
    } catch (error) {
      return error.message || null;
    }
  }

  async generateFlashcards(userId, materialId) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/generate-flashcards`,
        null,
        {
          params: { user_id: userId, material_id: materialId },
          timeout: 45000,
        },
      );
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.detail ||
          `Failed to generate flashcards: ${error.message}`,
      );
    }
  }

  async getFlashcards(userId, materialId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/flashcards/${userId}/${materialId}`,
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch flashcards: ${error.message}`);
    }
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to check API health: ${error.message}`);
    }
  }
}

export default new BrAInwaveAPI();
