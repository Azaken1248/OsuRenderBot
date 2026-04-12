import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commands = [];

const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath));
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}
const rest = new REST().setToken(process.env.DISCORD_TOKEN);
const guildId = process.env.GUILD_ID;

(async () => {
    try {
        const target = guildId ? `guild ${guildId}` : 'global application';
        const route = guildId
            ? Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId)
            : Routes.applicationCommands(process.env.CLIENT_ID);

        console.log(`Started refreshing ${commands.length} application (/) commands for ${target}.`);

        const data = await rest.put(
            route,
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands for ${target}.`);
    } catch (error) {
        console.error(error);
    }
})();