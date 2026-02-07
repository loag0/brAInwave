import axios from "axios";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

class BrAInwaveAPI {
  // Added userId to params to match backend requirement
  async uploadTimetable(userId, fileUri, fileName, fileType) {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: fileType,
    });

    // Removed trailing slash and added user_id query param
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

  async uploadSyllabus(userId, fileUri, fileName, fileType) {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: fileType,
    });

    try {
      // Added user_id query param
      const response = await axios.post(
        `${API_BASE_URL}/upload-syllabus?user_id=${userId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000,
        },
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to upload syllabus: ${error.message}`);
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
      const response = await axios.get(
        `${API_BASE_URL}/daily-plans/${userId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.detail || "failed to fetch daily plans"
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

  async generateDailyPlan(userId, date, customTasks = []) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/generate-plan`,
        {
          user_id: userId,
          date: date,
          customTasks: customTasks,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        },
      );
      return response.data;
    } catch (error) {
      console.error(
        "Error in generateDailyPlan: ",
        error.response?.data || error.message,
      );
      throw new Error(`Failed to generate daily plan: ${error.message}`);
    }
  }

  async getDailyPlan(userId, date){
    try{
      const response = await axios.get(`${API_BASE_URL}/daily-plan/${userId}/${date}`);
      return response.data;
    } catch(error){
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
