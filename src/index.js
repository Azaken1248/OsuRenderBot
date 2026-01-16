import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, GatewayIntentBits, Collection } from 'discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath));
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

client.on('interactionCreate', async (interaction) => {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Handle Autocomplete (for /render skin selection)
    if (interaction.isAutocomplete() && command.autocomplete) {
        await command.autocomplete(interaction);
    }

    if (interaction.isChatInputCommand()) {
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Error executing command!', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);