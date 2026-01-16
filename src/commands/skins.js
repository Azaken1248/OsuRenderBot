import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { renderAPI } from '../utils/api.js';

export const data = new SlashCommandBuilder()
    .setName('skins')
    .setDescription('List all available osu! skins on the server');

export async function execute(interaction) {
    // 1. Tell Discord to wait (Fixes the 10062 Error)
    await interaction.deferReply(); 

    try {
        const skins = await renderAPI.getSkins();
        
        const embed = new EmbedBuilder()
            .setTitle('🎨 Cloud Skins')
            .setColor('#ff66aa')
            .setDescription(skins.map(s => `• ${s}`).join('\n') || 'No skins found.');
        
        // 2. Use editReply because we already deferred
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error(err);
        await interaction.editReply('❌ Failed to fetch skins from the API.');
    }
}