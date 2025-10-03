# Slack App Setup Guide 🚀

This guide will walk you through creating and configuring your Slack app for the Birthday Bot.

## Step 1: Create a Slack App

1. **Go to Slack API**: Visit [https://api.slack.com/apps](https://api.slack.com/apps)
2. **Click "Create New App"**
3. **Choose "From scratch"**
4. **Enter App Name**: `Birthday Bot` (or whatever you prefer)
5. **Select Workspace**: Choose your Slack workspace
6. **Click "Create App"**

## Step 2: Basic Information

1. **App Name**: Keep or change as desired
2. **Short Description**: "A bot for personalized birthday greetings"
3. **App Icon**: Upload a fun birthday-themed icon (optional)
4. **Background Color**: Choose a festive color (optional)

## Step 3: Enable Socket Mode

1. **Go to "Socket Mode"** in the left sidebar
2. **Toggle "Enable Socket Mode"** to ON
3. **Click "Generate"** to create an App-Level Token
4. **Copy the token** (starts with `xapp-`) - you'll need this for your `.env` file
5. **Add Token Scopes**:
   - `connections:write`
   - `authorizations:read`

## Step 4: Create Bot User

1. **Go to "OAuth & Permissions"** in the left sidebar
2. **Scroll down to "Scopes"**
3. **Add these Bot Token Scopes**:
   - `chat:write` - Post messages
   - `reactions:write` - Add reactions
   - `commands` - Use slash commands
   - `channels:read` - Read channel information
   - `groups:read` - Read private channel information
   - `im:read` - Read direct messages
   - `mpim:read` - Read group messages

### Optional: Post as User Feature

If you want the bot to post as you instead of the bot (set `"postAsUser": true` in config):

4. **Add User Token Scopes** (in addition to Bot Token Scopes):
   - `chat:write` - Post messages as user
   - `reactions:write` - Add reactions as user

5. **Install App to Workspace** (if not already done)
6. **Copy User OAuth Token** (starts with `xoxp-`) - you'll need this for your `.env` file

## Step 5: Install App to Workspace

1. **Scroll up to "OAuth Tokens for Your Workspace"**
2. **Click "Install to Workspace"**
3. **Review permissions and click "Allow"**
4. **Copy the Bot User OAuth Token** (starts with `xoxb-`) - you'll need this for your `.env` file

## Step 6: Create Slash Command

1. **Go to "Slash Commands"** in the left sidebar
2. **Click "Create New Command"**
3. **Fill in the details**:
   - **Command**: `/birthdaybot`
   - **Request URL**: `https://your-domain.com/slack/events` (we'll update this later)
   - **Short Description**: "Post personalized birthday greetings"
   - **Usage Hint**: `@username1, @username2`
4. **Click "Save"**

## Step 7: Get Your Signing Secret

1. **Go to "Basic Information"** in the left sidebar
2. **Find "Signing Secret"**
3. **Click "Show"** and copy the secret - you'll need this for your `.env` file

## Step 8: Configure Environment Variables

1. **Copy `env.example` to `.env`**:
   ```bash
   cp env.example .env
   ```

2. **Edit `.env` with your tokens**:
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   SLACK_SIGNING_SECRET=your-signing-secret-here
   SLACK_APP_TOKEN=xapp-your-app-token-here
   PORT=3000
   ```

## Step 9: Test Locally (Optional)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the bot**:
   ```bash
   npm start
   ```

3. **Test in Slack**:
   - Go to any channel
   - Type `/birthdaybot --test @yourself`
   - You should see a test message!

## Step 10: Deploy with Docker

1. **Make sure your `.env` file is in the project directory**
2. **Add the `compose.yaml` to your Dockge**
3. **Start the container**
4. **Update the Slash Command URL** in your Slack app:
   - Go back to "Slash Commands"
   - Update the Request URL to: `https://your-server-ip:3000/slack/events`
   - Click "Save"

## Step 11: Test the Bot

1. **Create a test channel** (e.g., #birthday-bot-test)
2. **Test the command**:
   ```
   /birthdaybot --test @yourself
   ```
3. **Verify it works**, then test without `--test`:
   ```
   /birthdaybot @yourself
   ```

## Troubleshooting

### Common Issues:

1. **"Command not found"**: Make sure you've installed the app to your workspace
2. **"Permission denied"**: Check that the bot has the right scopes
3. **"Invalid request"**: Verify your tokens are correct in `.env`
4. **"Channel not found"**: Make sure #announcements channel exists

### Debug Steps:

1. **Check Docker logs**:
   ```bash
   docker logs slack-birthday-bot
   ```

2. **Verify environment variables**:
   ```bash
   docker exec slack-birthday-bot env | grep SLACK
   ```

3. **Test health endpoint**:
   ```bash
   curl http://your-server:3000/health
   ```

## Security Notes

- **Never commit your `.env` file** to version control
- **Keep your tokens secure** - they provide access to your Slack workspace
- **Use environment variables** in production
- **Regularly rotate tokens** if needed

## Next Steps

Once everything is working:

1. **Customize your messages** in `config/messages.json`
2. **Add your favorite reactions** in `config/reactions.json`
3. **Test with real users** in a private channel
4. **Deploy to #announcements** when ready!

## Need Help?

- Check the main README.md for configuration details
- Review Docker logs for error messages
- Test with `/birthdaybot-help` for usage instructions
