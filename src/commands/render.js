import { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import axios from 'axios';
import { renderAPI, API_BASE_URL } from '../utils/api.js';

let skinCache = [];
let lastFetch = 0;
const CACHE_TTL = 60000;
const UNFURL_CHECK_ATTEMPTS = 10;
const UNFURL_CHECK_DELAY_MS = 1500;
const jobMetadata = new Map(); 

function toApiUrl(pathOrUrl) {
    if (!pathOrUrl) {
        return null;
    }

    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }

    const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${API_BASE_URL}${path}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function canUseEmbeds(interaction) {
    if (!interaction.inGuild()) {
        return true;
    }

    const channel = interaction.channel;
    const me = interaction.guild?.members?.me;
    if (!channel || !me || typeof channel.permissionsFor !== 'function') {
        return true;
    }

    const permissions = channel.permissionsFor(me);
    return permissions?.has(PermissionFlagsBits.EmbedLinks) ?? true;
}

async function hasGeneratedUnfurl(interaction, messageId) {
    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || !channel.messages?.fetch) {
        return false;
    }

    for (let i = 0; i < UNFURL_CHECK_ATTEMPTS; i += 1) {
        await sleep(UNFURL_CHECK_DELAY_MS);

        try {
            const refreshed = await channel.messages.fetch(messageId);
            if (refreshed.flags.has(MessageFlags.SuppressEmbeds)) {
                return false;
            }

            if (refreshed.embeds.length > 0) {
                return true;
            }
        } catch {
            // Unfurls are async; keep retrying for a few seconds.
        }
    }

    return false;
}

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
            { name: 'Ultra (4K)', value: 'ultra' },
            { name: 'Cinematic (1080p high bitrate)', value: 'cinematic' }
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

        const viewUrl = toApiUrl(result.view_url || `/view/${result.job_id}`);
        const videoUrl = toApiUrl(result.video_url || `/video/${result.job_id}.mp4`);
        const thumbnailUrl = toApiUrl(result.thumbnail_url || `/thumbnail/${result.job_id}.jpg`);

        jobMetadata.set(result.job_id, {
            skin,
            quality,
            fileName: replayAttachment.name,
            userId: interaction.user.id,
            submittedAt: new Date(),
            viewUrl,
            videoUrl,
            thumbnailUrl
        });

        const embed = new EmbedBuilder()
            .setTitle('▶ Render Job Started')
            .setURL(viewUrl)
            .setColor('#fba295')
            .addFields(
                { name: 'Job ID', value: `\`${result.job_id}\``, inline: true },
                { name: 'Skin', value: `\`${skin}\``, inline: true },
                { name: 'Quality', value: `\`${quality}\``, inline: true },
                { name: 'Links', value: `[View Page](${viewUrl}) | [Direct MP4](${videoUrl})` }
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
                const metadata = jobMetadata.get(jobId) || {};
                const viewUrl = metadata.viewUrl || toApiUrl(`/view/${jobId}`);
                const videoUrl = metadata.videoUrl || toApiUrl(`/video/${jobId}.mp4`);
                const thumbnailUrl = metadata.thumbnailUrl || toApiUrl(data.thumbnail_url || `/thumbnail/${jobId}.jpg`);
                
                const fallbackEmbed = new EmbedBuilder()
                    .setTitle('✓ Render Complete')
                    .setURL(viewUrl)
                    .setColor('#00b388')
                    .setDescription('Discord preview did not load, so here is the fallback card.')
                    .addFields(
                        { name: '📁 File', value: metadata.fileName || 'Unknown' },
                        { name: '🔗 View', value: `[Open Render Page](${viewUrl})`, inline: true },
                        { name: '🎬 Video', value: `[Direct Video (.mp4)](${videoUrl})`, inline: true },
                        { name: '🖼 Thumbnail', value: `[Open Thumbnail](${thumbnailUrl})`, inline: true }
                    )
                    .setImage(thumbnailUrl)
                    .setFooter({ text: `Job ID: ${jobId}` })
                    .setTimestamp();

                const previewMessage = await interaction.followUp({
                    content: `✓ **Render Finished!** <@${interaction.user.id}>\n${viewUrl}`,
                    allowedMentions: { users: [interaction.user.id] }
                });

                const embedPermission = canUseEmbeds(interaction);
                let unfurlWorked = false;

                if (embedPermission) {
                    unfurlWorked = await hasGeneratedUnfurl(interaction, previewMessage.id);
                }

                if (!unfurlWorked) {
                    if (embedPermission) {
                        await interaction.followUp({ embeds: [fallbackEmbed] });
                    } else {
                        await interaction.followUp({
                            content: `Embed previews are disabled in this channel. File: **${metadata.fileName || 'Unknown'}**\n${viewUrl}\n${thumbnailUrl}`
                        });
                    }
                }

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