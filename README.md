# RenderBot

A Discord bot for submitting osu! replay files to a cloud-based GPU rendering service. Users can upload `.osr` replay files, select custom skins, and receive high-quality rendered videos directly through Discord.

[Invite RenderBot to your server](https://discord.com/oauth2/authorize?client_id=1461432321722028206&permissions=116736&integration_type=0&scope=applications.commands+bot)

## Features

- **Replay Rendering**: Submit osu! replay files for cloud-based video rendering
- **Custom Skins**: Choose from available community skins with autocomplete support
- **Quality Options**: Render in Standard (1080p) or Ultra (4K) resolution
- **Skin Management**: Upload and manage `.osk` skin files
- **Job Tracking**: Real-time polling and notifications when renders complete
- **Smart Caching**: Optimized skin list caching for fast autocomplete responses

## Commands

### `/render`
Submit an osu! replay file for rendering.

**Options:**
- `replay` (required): The `.osr` replay file to render
- `skin` (optional): Choose from available skins (autocomplete enabled)
- `quality` (optional): Output resolution - Standard (1080p) or Ultra (4K)

**Example Usage:**
```
/render replay:my_play.osr skin:Rafis quality:ultra
```

### `/skins`
List all available skins on the rendering server.

### `/upload_skin`
Upload a new `.osk` skin file to the cloud server.

**Options:**
- `skin_file` (required): The `.osk` skin archive to upload

## Installation

### Prerequisites

- Node.js 16.9.0 or higher
- A Discord Bot Token
- Discord Application Client ID
- Access to the render API endpoint

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Azaken1248/OsuRenderBot.git
cd OsuRenderBot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_client_id
```

4. Deploy slash commands to Discord:
```bash
node deploy-commands.js
```

5. Start the bot:
```bash
node src/index.js
```

## Configuration

The bot connects to the render API at `https://api.render.azaken.com` by default. To modify the API endpoint, update the `API_BASE_URL` constant in `src/utils/api.js`.

### Cache Settings

Skin autocomplete data is cached for 60 seconds by default. Adjust the `CACHE_TTL` value in `src/commands/render.js` to modify this behavior.

## Project Structure

```
RenderBot/
├── src/
│   ├── index.js              # Main bot client and event handlers
│   ├── commands/
│   │   ├── render.js         # Replay rendering command with autocomplete
│   │   ├── skins.js          # List available skins
│   │   └── upload_skin.js    # Skin upload command
│   └── utils/
│       └── api.js            # API client for render service
├── deploy-commands.js        # Discord slash command registration
├── package.json
└── .env                      # Environment variables (not tracked)
```

## API Integration

The bot interfaces with a custom rendering API that provides the following endpoints:

- `GET /skins` - Retrieve list of available skins
- `GET /status/{job_id}` - Check render job status
- `POST /skins/upload` - Upload new skin files
- `POST /render` - Submit replay for rendering

## Dependencies

- **discord.js** (^14.25.1) - Discord API wrapper
- **axios** (^1.13.2) - HTTP client for API requests
- **dotenv** (^17.2.3) - Environment variable management
- **form-data** (^4.0.5) - Multipart form data handling

## Development

The project uses ES modules (`"type": "module"` in `package.json`). All imports must use the `.js` file extension.

### Adding New Commands

1. Create a new file in `src/commands/`
2. Export `data` (SlashCommandBuilder) and `execute` function
3. Run `node deploy-commands.js` to register the command

## License

ISC

## Author

Azaken1248

## Support

For issues related to the rendering service or API, contact the service administrator. For bot-related issues, please open an issue on the GitHub repository.
