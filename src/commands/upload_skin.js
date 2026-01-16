import { SlashCommandBuilder } from 'discord.js';
import axios from 'axios';
import { renderAPI } from '../utils/api.js';

export const data = new SlashCommandBuilder()
    .setName('upload_skin')
    .setDescription('Upload a new .osk skin to the cloud')
    .addAttachmentOption(option => 
        option.setName('skin_file').setDescription('The .osk file').setRequired(true));

export async function execute(interaction) {
    await interaction.deferReply();
    const attachment = interaction.options.getAttachment('skin_file');

    if (!attachment.name.endsWith('.osk')) {
        return interaction.editReply('❌ Please upload a valid `.osk` file.');
    }

    try {
        const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
        const result = await renderAPI.uploadSkin(response.data, attachment.name);
        
        await interaction.editReply(`✅ **Success!** Skin \`${result.skin_name}\` is now available for rendering.`);
    } catch (err) {
        const errorMsg = err.response?.data?.detail || err.message;
        await interaction.editReply(`❌ Upload failed: ${errorMsg}`);
    }
}