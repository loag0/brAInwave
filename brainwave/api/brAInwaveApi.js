import axios from "axios";

const API_BASE_URL = "5.4.13.210:8000"; // Adjust the URL as needed

class BrAInwaveAPI {

    async uploadTimetable(fileUri, fileName, fileType){
        const formData = new FormData();
        formData.append("file", {
            uri: fileUri,
            name: fileName,
            type: fileType,
        });

        const response = await axios.post(
            `${API_BASE_URL}/upload-timetable/`,
            formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
                timeout: 60000, // 60 seconds timeout
            }
        );
        return response.data;
    }

    async uploadSyllabus(fileUri, fileName, fileType){
        const formData = new FormData();
        formData.append("file", {
            uri: fileUri,
            name: fileName,
            type: fileType,
        });

        try {
            const response = await axios.post(
                `${API_BASE_URL}/upload-syllabus/`,
                formData, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                    timeout: 60000, // 60 seconds timeout
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to upload syllabus: ${error.message}`);
        }
    }

    async getStudyPlan(planId){
        try {
            const response = await axios.get(`${API_BASE_URL}/study-plan/${planId}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get study plan: ${error.message}`);
        }
    }

    async listStudyPlans(){
        try{
            const response = await axios.get(`${API_BASE_URL}/study-plans/`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to list study plans: ${error.message}`);
        }
    }

    async deleteStudyPlan(planId){
        try {
            const response = await axios.delete(`${API_BASE_URL}/study-plan/${planId}`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to delete study plan: ${error.message}`);
        }
    }

    async generateDailyPlan(userId, date){
        try{
            const response = await axios.post(`${API_BASE_URL}/generate-plan/`, {
                user_id: userId,
                date: date
            }, {
                headers: {
                    "Content-Type": "applications/json"
                },
                timeout: 30000
            });
            return response.data;
        } catch(error){
            console.error("Error in generateDailyPlan: ", error.response?.data || error.message);
            throw new Error(`Failed to generate daily plan: ${error.message}`);
        }
    }

    async checkHealth(){
        try {
            const response = await axios.get(`${API_BASE_URL}/health/`);
            return response.data;
        } catch (error) {
            throw new Error(`Failed to check API health: ${error.message}`);
        }
    }
}

export default new BrAInwaveAPI();