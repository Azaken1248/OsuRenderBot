import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { renderAPI } from '../utils/api.js';

export const data = new SlashCommandBuilder()
    .setName('skins')
    .setDescription('List all available osu! skins on the server');

export async function execute(interaction) {
    await interaction.deferReply(); 

    try {
        const skins = await renderAPI.getSkins();
        
        const embed = new EmbedBuilder()
            .setTitle('◆ Cloud Skins')
            .setColor('#fba295')
            .setDescription(skins.map(s => `• ${s}`).join('\n') || 'No skins found.');

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error(err);
        await interaction.editReply('✕ Failed to fetch skins from the API.');
    }
}