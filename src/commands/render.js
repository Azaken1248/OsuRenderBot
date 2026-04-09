import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { renderAPI } from '../utils/api.js';

let skinCache = [];
let lastFetch = 0;
const CACHE_TTL = 60000;
const jobMetadata = new Map(); 

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
        ))
    .addNumberOption(option => 
        option.setName('bg_dim').setDescription('Background dim (e.g., 0-100)'))
    .addBooleanOption(option => 
        option.setName('motion_blur').setDescription('Enable motion blur'))
    .addBooleanOption(option => 
        option.setName('storyboard').setDescription('Enable storyboard'))
    .addBooleanOption(option => 
        option.setName('video').setDescription('Enable background video'))
    .addBooleanOption(option => 
        option.setName('snaking_in').setDescription('Enable snaking in sliders'))
    .addBooleanOption(option => 
        option.setName('snaking_out').setDescription('Enable snaking out sliders'))
    .addBooleanOption(option => 
        option.setName('hit_error_meter').setDescription('Show hit error meter'))
    .addBooleanOption(option => 
        option.setName('key_overlay').setDescription('Show key overlay'));

export async function autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    if (Date.now() - lastFetch > CACHE_TTL) {
        updateSkinCache();
    }

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
    const bg_dim = interaction.options.getNumber('bg_dim');
    const motion_blur = interaction.options.getBoolean('motion_blur');
    const storyboard = interaction.options.getBoolean('storyboard');
    const video = interaction.options.getBoolean('video');
    const snaking_in = interaction.options.getBoolean('snaking_in');
    const snaking_out = interaction.options.getBoolean('snaking_out');
    const hit_error_meter = interaction.options.getBoolean('hit_error_meter');
    const key_overlay = interaction.options.getBoolean('key_overlay');

    if (!replayAttachment.name.endsWith('.osr')) {
        return interaction.editReply('✕ Error: The file must be a `.osr` replay file.');
    }

    try {
        const fileResponse = await axios.get(replayAttachment.url, { responseType: 'arraybuffer' });
        
        const result = await renderAPI.submitRender(fileResponse.data, replayAttachment.name, { 
            skin, quality, bg_dim, motion_blur, storyboard, video, 
            snaking_in, snaking_out, hit_error_meter, key_overlay
        });

        jobMetadata.set(result.job_id, {
            skin,
            quality,
            fileName: replayAttachment.name,
            userId: interaction.user.id,
            submittedAt: new Date()
        });

        const embed = new EmbedBuilder()
            .setTitle('▶ Render Job Started')
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
        await interaction.editReply(`✕ **Render Failed:** ${err.response?.data?.detail || "API unreachable"}`);
    }
}

async function pollJobStatus(jobId, interaction) {
    const interval = setInterval(async () => {
        try {
            const data = await renderAPI.getStatus(jobId);
            if (data.status === 'complete') {
                clearInterval(interval);
                
                const videoUrl = `https://api.render.azaken.com/video/${jobId}`;
                const metadata = jobMetadata.get(jobId) || {};
                
                const completionEmbed = new EmbedBuilder()
                    .setTitle('✓ Render Complete')
                    .setURL(videoUrl)
                    .setColor('#00b388')
                    .setDescription(`[▶ Watch Replay](${videoUrl})`)
                    .addFields(
                        { name: '📁 File', value: metadata.fileName || 'Unknown', inline: true },
                        { name: '⚙ Skin', value: metadata.skin || 'Default', inline: true },
                        { name: '📺 Quality', value: metadata.quality || 'standard', inline: true }
                    )
                    .setImage(videoUrl)
                    .setFooter({ text: `Job ID: ${jobId}` })
                    .setTimestamp();

                await interaction.followUp({
                    content: `✓ **Render Finished!** <@${interaction.user.id}>`,
                    embeds: [completionEmbed]
                });

                jobMetadata.delete(jobId);
            } else if (data.status === 'error') {
                clearInterval(interval);
                
                const errorEmbed = new EmbedBuilder()
                    .setTitle('✕ Render Failed')
                    .setColor('#ff6b6b')
                    .setDescription(data.error || 'An unknown error occurred.')
                    .setFooter({ text: `Job ID: ${jobId}` })
                    .setTimestamp();

                await interaction.followUp({
                    embeds: [errorEmbed]
                });

                jobMetadata.delete(jobId);
            }
        } catch (e) {}
    }, 10000); 
}