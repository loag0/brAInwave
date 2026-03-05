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
   * Used in: useTimetableUpload hook
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
        headers: {
          "Content-Type": "multipart/form-data",
          "ngrok-skip-browser-warning": true,
        },
        timeout: 60000,
      },
    );
    return response.data;
  }

  /**
   * Uploads a syllabus PDF/image to generate a study plan.
   * Matching Endpoint: POST /upload-syllabus
   * Used in: Dashboard (index.tsx)
   */
  async uploadSyllabus(userId, fileUri, fileName, fileType) {
    const formData = new FormData();

    const fileToUpload = {
      uri: fileUri,
      name: fileName || "file.pdf",
      type: fileType || "application/pdf",
    };

    formData.append("file", fileToUpload);

    try {
      const response = await axios({
        method: "post",
        url: `${API_BASE_URL}/upload-syllabus`,
        params: { user_id: userId },
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
          "ngrok-skip-browser-warning": "true",
          Accept: "application/json",
        },
        transformRequest: (data) => {
          return data;
        },
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
   * Used in: Dashboard (index.tsx)
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
          "ngrok-skip-browser-warning": "true",
          Accept: "application/json",
        },
        transformRequest: (data) => {
          return data;
        },
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        console.log("Assignment Upload Error:", error.response.data);
      }
      throw error;
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
        error.response?.data?.detail || "failed to fetch daily plans",
      );
    }
  }

  /**
   * Lists all timetables imported by the user.
   * Matching Endpoint: GET /timetables/{userId}
   * Used in: useContent hook
   */
  async listTimetables(userId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/timetables/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to list timetables: ${error.message}`);
    }
  }

  /**
   * Deletes a specific timetable.
   * Matching Endpoint: DELETE /timetable/{userId}/{timetableId}
   * Used in: useContent hook (planned)
   */
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

  /**
   * Fetches specific assignment details.
   */
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

  /**
   * Lists all assignments for the user.
   */
  async listAssignments(userId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/assignments/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to list assignments: ${error.message}`);
    }
  }

  /**
   * Deletes a specific assignment.
   */
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

  /**
   * Deletes a specific study plan/material.
   */
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

  /**
   * Deletes a specific task from a daily plan.
   */
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

  /**
   * Used for generating the daily plan considering user-specific preferences
   * @param {string} userId
   * @param {string} date
   * @param {Object} preferences
   * @param {Array} customTasks
   */

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
        date: date,

        isMorningPerson: preferences.isMorningPerson,
        preferredSessionLength: preferences.preferredSessionLength,
        mode: preferences.mode,
        subjectPriorities: preferences.subjectPriorities,
        customTasks: customTasks,
      };
      if (userNote) body.userNote = userNote;

      const response = await axios.post(`${API_BASE_URL}/generate-plan`, body, {
        headers: { "Content-Type": "application/json" },
        "ngrok-skip-browser-warning": true,
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

  // Flashcards
  async generateFlashcards(userId, materialId) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/generate-flashcards`,
        null,
        {
          params: { user_id: userId, material_id: materialId },
          headers: { "ngrok-skip-browser-warning": true },
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
