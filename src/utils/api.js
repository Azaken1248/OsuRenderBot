import axios from 'axios';
import FormData from 'form-data';

export const API_BASE_URL = (process.env.RENDER_API_URL || 'https://api.render.azaken.com').replace(/\/+$/, '');

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
        
        form.append('skin', options.skin || 'Default');
        form.append('quality', options.quality || 'standard');
        
        if (options.bg_dim !== null && options.bg_dim !== undefined) {
            form.append('bg_dim', String(options.bg_dim));
        }
        
        form.append('motion_blur', String(options.motion_blur ?? true));
        
        const optionalBools = [
            'storyboard', 'video', 'snaking_in', 
            'snaking_out', 'hit_error_meter', 'key_overlay'
        ];
        
        for (const key of optionalBools) {
            if (options[key] !== null && options[key] !== undefined) {
                form.append(key, String(options[key]));
            }
        }
        
        const { data } = await axios.post(`${API_BASE_URL}/render`, form, {
            headers: form.getHeaders()
        });
        return data;
    }
}