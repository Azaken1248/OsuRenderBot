import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { renderAPI } from '../utils/api.js';

let skinCache = [];
let lastFetch = 0;
const CACHE_TTL = 60000; 

async function updateSkinCache() {
    try {
        const skins = await renderAPI.getSkins();
        skinCache = skins;
        lastFetch = Date.now();
        console.log(`[Cache] Updated ${skins.length} skins.`);
    } catch (err) {
        console.error("[Cache] Failed to fetch skins for autocomplete.");
    }
}
updateSkinCache();

export const data = new SlashCommandBuilder()
    .setName('render')
    .setDescription('Submit an osu! replay to the cloud GPU renderer')
    .addAttachmentOption(option => 
        option.setName('replay').setDescription('The .osr replay file').setRequired(true))
    .addStringOption(option => 
        option.setName('skin').setDescription('Choose a skin').setAutocomplete(true))
    .addStringOption(option => 
        option.setName('quality').setDescription('Output resolution').addChoices(
            { name: 'Standard (1080p)', value: 'standard' },
            { name: 'Ultra (4K)', value: 'ultra' }
        ));

export async function autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    // Refresh cache in the background if it's old (don't 'await' it here!)
    if (Date.now() - lastFetch > CACHE_TTL) {
        updateSkinCache();
    }

    // Use the cached list immediately (Instant response)
    const filtered = skinCache
        .filter(choice => choice.toLowerCase().includes(focusedValue))
        .slice(0, 25);

    try {
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    } catch (err) {
        console.error("Autocomplete respond error:", err.code);
    }
}

export async function execute(interaction) {
    await interaction.deferReply();
    const replayAttachment = interaction.options.getAttachment('replay');
    const skin = interaction.options.getString('skin') || 'Default';
    const quality = interaction.options.getString('quality') || 'standard';

    if (!replayAttachment.name.endsWith('.osr')) {
        return interaction.editReply('❌ Error: The file must be a `.osr` replay file.');
    }

    try {
        const fileResponse = await axios.get(replayAttachment.url, { responseType: 'arraybuffer' });
        const result = await renderAPI.submitRender(fileResponse.data, replayAttachment.name, { 
            skin, quality, motionBlur: true
        });

        const embed = new EmbedBuilder()
            .setTitle('🎬 Render Job Started')
            .setURL(`https://api.render.azaken.com/view/${result.job_id}`)
            .setColor('#fba295')
            .addFields(
                { name: 'Job ID', value: `\`${result.job_id}\``, inline: true },
                { name: 'Skin', value: `\`${skin}\``, inline: true },
                { name: 'Quality', value: `\`${quality}\``, inline: true }
            )
            .setDescription('Your replay is being processed. You will be pinged when finished.')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        pollJobStatus(result.job_id, interaction);
    } catch (err) {
        console.error(err);
        await interaction.editReply(`❌ **Render Failed:** ${err.response?.data?.detail || "API unreachable"}`);
    }
}

async function pollJobStatus(jobId, interaction) {
    const interval = setInterval(async () => {
        try {
            const data = await renderAPI.getStatus(jobId);
            if (data.status === 'complete') {
                clearInterval(interval);
                await interaction.followUp({
                    content: `✅ **Render Finished!** <@${interaction.user.id}>\n🔗 **View:** https://api.render.azaken.com/video/${jobId}`
                });
            } else if (data.status === 'error') {
                clearInterval(interval);
                await interaction.followUp(`❌ **Job ${jobId} failed.**`);
            }
        } catch (e) {}
    }, 10000); 
}