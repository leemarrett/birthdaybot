# Slack Birthday Boi 🎉

A personalized Slack bot for birthday greetings with customizable messages and reactions.

## Features

- **Slash Command**: `/birthdayboi @user1, @user2, @user3...`
- **Smart Messaging**: Different templates for 1, 2, or 3+ birthdays
- **Dual Reaction System**: Always-add favorites + random additional reactions
- **Editable Configuration**: JSON files for easy customization
- **Docker Deployment**: Ready for Dockge deployment

## Quick Start

### 1. Slack App Setup

1. Go to [Slack API](https://api.slack.com/apps) and create a new app
2. Enable Socket Mode and get your App-Level Token
3. Create a Bot User and get your Bot User OAuth Token
4. Get your Signing Secret from Basic Information
5. Add the following OAuth Scopes:
   - `chat:write`
   - `reactions:write`
   - `commands`
   - `users:read` (needed to map `@handle` in slash commands to the correct member)
6. Create a slash command `/birthdayboi`

### 2. Environment Setup

1. Copy `env.example` to `.env`
2. Fill in your Slack tokens:
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_APP_TOKEN=xapp-your-app-token
   ```

### 3. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or start production server
npm start
```

### 4. Docker Deployment (Dockge)

1. Copy your `.env` file to the project directory
2. Use the provided `compose.yaml` in Dockge
3. The bot will be available on port 3000

## Configuration

### Message Templates (`config/messages.json`)

Edit message templates for different birthday counts:

```json
{
  "settings": {
    "postAsUser": false,
    "botName": "Birthday Boi",
    "botIcon": ":birthday:"
  },
  "single": [
    "Happy birthday, {user}! 🎉",
    "Wishing you the happiest of birthdays, {user}! 🎂"
  ],
  "double": [
    "Happy birthday, {user1}, and let's not forget about you, {user2}!! You're both important! 🎉"
  ],
  "multiple": [
    "Happy birthday to {user1}, {user2}, and {user3}! 🎉"
  ]
}
```

**Settings Options:**
- `postAsUser`: Set to `true` to post as the user instead of the bot
- `botName`: Custom name for the bot (when not posting as user)
- `botIcon`: Custom emoji for the bot (when not posting as user)

### Reaction Lists (`config/reactions.json`)

Customize your reaction lists:

```json
{
  "favorites": ["🎉", "🎂", "🎈", "🥳"],
  "additional": ["🎊", "🎁", "✨", "🌟", "💫"]
}
```

## Usage

### Slash Command

```
/birthdayboi @username1
/birthdayboi @username1, @username2
/birthdayboi @username1, @username2, @username3
```

### Test Mode

Test the bot in a private channel before posting to #announcements:

```
/birthdayboi --test @username1
/birthdayboi -t @username1, @username2
```

**Test Mode Features:**
- Posts to the current channel instead of #announcements
- Adds "🧪 **TEST MODE** 🧪" prefix to the message
- Shows confirmation message
- Perfect for testing message templates and reactions

### Message Templates

- **Single**: Uses `{user}` placeholder
- **Double**: Uses `{user1}` and `{user2}` placeholders  
- **Multiple**: Uses `{user1}`, `{user2}`, `{user3}` placeholders

### Reactions

- **Favorites**: Always added in random order (12 reactions)
- **Additional**: Randomly selected (5-10 reactions)
- **Total**: 17-22 reactions per message

## Docker Deployment

### Using Dockge

1. Add the `compose.yaml` file to your Dockge setup
2. Ensure your `.env` file is in the project directory
3. The bot will automatically start and restart on failure

### Manual Docker

```bash
# Build the image
docker build -t slack-birthday-boi .

# Run the container
docker run -d \
  --name slack-birthday-boi \
  --env-file .env \
  -p 3000:3000 \
  -v $(pwd)/config:/app/config \
  slack-birthday-boi
```

## Development

### Project Structure

```
birthdayboi/
├── src/
│   ├── bot.js              # Main bot logic
│   ├── config/
│   │   ├── messages.json    # Message templates
│   │   └── reactions.json    # Reaction lists
│   ├── handlers/
│   │   └── birthday.js       # Birthday command handler
│   └── utils/
│       └── config.js         # Configuration management
├── compose.yaml              # Dockge configuration
├── Dockerfile
├── package.json
└── README.md
```

### Hot Reloading

Configuration files are automatically reloaded when changed (in development mode).

## Troubleshooting

### Common Issues

1. **Bot not responding**: Check your Slack tokens and app permissions
2. **Reactions not working**: Ensure the bot has `reactions:write` scope
3. **Messages not posting**: Check the `#announcements` channel exists and bot has access

### Logs

Check Docker logs:
```bash
docker logs slack-birthday-boi
```

## License

MIT License - feel free to customize and use!
