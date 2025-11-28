const { App } = require('@slack/bolt');
require('dotenv').config();

const BirthdayHandler = require('./handlers/birthday');

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000
});

// Create user client if user token is provided (for postAsUser feature)
let userClient = null;
if (process.env.SLACK_USER_TOKEN) {
  const { WebClient } = require('@slack/web-api');
  userClient = new WebClient(process.env.SLACK_USER_TOKEN);
}

// Get command name from environment or use default
const COMMAND_NAME = process.env.SLACK_COMMAND_NAME || '/birthdaybot';
const HELP_COMMAND_NAME = process.env.SLACK_COMMAND_NAME ? `${process.env.SLACK_COMMAND_NAME}-help` : '/birthdaybot-help';

// Initialize birthday handler
const birthdayHandler = new BirthdayHandler();

// Register slash command
app.command(COMMAND_NAME, async ({ ack, respond, command, client }) => {
  // Use user client if available and postAsUser is enabled
  const effectiveClient = userClient || client;
  await birthdayHandler.handleBirthdayCommand(ack, respond, command, effectiveClient);
});

// Help command
app.command(HELP_COMMAND_NAME, async ({ ack, respond }) => {
  await ack();
  await respond({
    text: `🎉 **Birthday Boi Help** 🎉

**Usage:**
\`${COMMAND_NAME} @username1\` - Single birthday (posts to #announcements)
\`${COMMAND_NAME} @user1, @user2\` - Multiple birthdays (posts to #announcements)
\`${COMMAND_NAME} --test @username\` - Test mode (posts to your DM)

**Behavior:**
- Normal mode: Always posts to #announcements
- Test mode (\`--test\` or \`-t\`): Posts to your DM for testing

**Configuration:**
- Edit \`config/messages.json\` for message templates
- Edit \`config/reactions.json\` for reaction lists
- Changes take effect immediately (no restart needed)

**Examples:**
\`${COMMAND_NAME} @leem\`
\`${COMMAND_NAME} @leem, @slack_user_2\`
\`${COMMAND_NAME} --test @leem, @slack_user_2, @user3\``,
    response_type: "ephemeral"
  });
});

// Health check endpoint (using Express directly)
const express = require('express');
const healthApp = express();

healthApp.get('/health', (req, res) => {
  res.status(200).send('Birthday Bot is running! 🎉');
});

// Start health check server on a different port
const healthPort = (process.env.PORT || 3000) + 1;
healthApp.listen(healthPort, () => {
  console.log(`Health check available at http://localhost:${healthPort}/health`);
});

// Error handling
app.error((error) => {
  console.error('Slack app error:', error);
});

// Start the app
(async () => {
  try {
    await app.start();
    console.log('🎉 Birthday Bot is running!');
    console.log(`Server is listening on port ${process.env.PORT || 3000}`);
  } catch (error) {
    console.error('Failed to start the app:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Birthday Bot...');
  await app.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down Birthday Bot...');
  await app.stop();
  process.exit(0);
});
