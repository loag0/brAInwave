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
  // Added userId to params to match backend requirement
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
        transformRequest: (data, headers) => {
          return data;
        },
      });
      return response.data;
    } catch (error) {
      console.log("Axios Error Object:", JSON.stringify(error, null, 2));
      throw error;
    }
  }

  // Backend now expects /{user_id}/{planId}
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
   * Used for generating the daily plan considering user-specific preferences
   * @param {string} userId
   * @param {string} date
   * @param {Object} preferences
   * @param {Array} customTasks
   */

  async generateDailyPlan(userId, date, preferences, customTasks = []) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/generate-plan`,
        {
          user_id: userId,
          date: date,

          isMorningPerson: preferences.isMorningPerson,
          preferredSessionLength: preferences.preferredSessionLength,
          mode: preferences.mode,
          subjectPriorities: preferences.subjectPriorities,
          customTasks: customTasks,
        },
        {
          headers: { "Content-Type": "application/json" },
          "ngrok-skip-browser-warning": true,
          timeout: 45000,
        },
      );
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
