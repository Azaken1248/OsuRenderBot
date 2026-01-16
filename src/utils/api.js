import axios from 'axios';
import FormData from 'form-data';


const API_BASE_URL = "https://api.render.azaken.com"

export const renderAPI = {
    async getSkins() {
        const { data } = await axios.get(`${API_BASE_URL}/skins`);
        return data;
    },

    async getStatus(jobId) {
        const { data } = await axios.get(`${API_BASE_URL}/status/${jobId}`);
        return data;
    },

    async uploadSkin(fileBuffer, fileName) {
        const form = new FormData();
        form.append('skin', fileBuffer, {filename: fileName});

        const { data } = await axios.post(`${API_BASE_URL}/skins/upload`, form, {
            headers: form.getHeaders()
        });
        return data;
    },

    async submitRender(fileBuffer, fileName, options) {
        const form = new FormData();
        form.append('replay', fileBuffer, fileName);
        form.append('skin', options.skin || 'default');
        form.append('quality', options.quality || 'standard');
        form.append('motion_blur', String(options.motion_blur ?? true));
        
        const { data } = await axios.post(`${API_BASE_URL}/render`, form, {
            headers: form.getHeaders()
        });
        return data;
    }
}