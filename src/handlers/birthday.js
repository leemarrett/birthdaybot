const ConfigManager = require('../utils/config');

class BirthdayHandler {
  constructor() {
    this.config = new ConfigManager();
    this.messages = this.config.loadMessages();
    this.reactions = this.config.loadReactions();
  }

  // Parse usernames from slash command text
  parseUsernames(text) {
    if (!text || text.trim() === '') {
      return [];
    }

    // Extract usernames from text like "@user1, @user2, @user3"
    const usernameRegex = /@(\w+)/g;
    const matches = text.match(usernameRegex);
    
    if (!matches) {
      return [];
    }

    // Remove @ symbol and return clean usernames
    return matches.map(match => match.substring(1));
  }

  // Get appropriate message template based on user count
  getMessageTemplate(userCount) {
    let templateKey;
    
    if (userCount === 1) {
      templateKey = 'single';
    } else if (userCount === 2) {
      templateKey = 'double';
    } else {
      templateKey = 'multiple';
    }

    const templates = this.messages[templateKey];
    if (!templates || templates.length === 0) {
      return `Happy birthday! 🎉`; // Fallback message
    }

    // Randomly select a template
    const randomIndex = Math.floor(Math.random() * templates.length);
    console.log(`Random index: ${randomIndex}, Total messages: ${templates.length}`);
    console.log(`Selected message: ${templates[randomIndex]}`);
    return templates[randomIndex];
  }

  // Format message with user mentions
  formatMessage(template, usernames) {
    let message = template;
    
    // Replace placeholders with actual user mentions
    usernames.forEach((username, index) => {
      const mention = `<@${username}>`;
      
      // Handle both {user} and {user1} for the first user
      if (index === 0) {
        message = message.replace(/{user}/g, mention);
        message = message.replace(/{user1}/g, mention);
      } else {
        // Replace {user2}, {user3}, etc.
        const placeholder = `{user${index + 1}}`;
        message = message.replace(new RegExp(placeholder, 'g'), mention);
      }
    });

    return message;
  }

  // Get reactions to add to the message
  getReactions() {
    const reactions = [];
    
    // Always add all favorite reactions in random order
    const shuffledFavorites = [...this.reactions.favorites].sort(() => Math.random() - 0.5);
    reactions.push(...shuffledFavorites);
    
    // Add some additional reactions (random selection)
    const additionalCount = Math.floor(Math.random() * 6) + 5; // 5-10 additional reactions
    const shuffledAdditional = [...this.reactions.additional].sort(() => Math.random() - 0.5);
    reactions.push(...shuffledAdditional.slice(0, additionalCount));
    
    return reactions;
  }

  // Parse command text for test mode and usernames
  parseCommand(text) {
    // Log the raw command text for debugging
    console.log(`[DEBUG] Raw command text: "${text}"`);
    
    if (!text) {
      console.log(`[DEBUG] Command text is empty or undefined`);
      return { isTestMode: false, usernames: [] };
    }
    
    const lowerText = text.toLowerCase();
    const isTestMode = lowerText.includes('--test') || lowerText.includes('-t') || lowerText.trim().startsWith('--test') || lowerText.trim().startsWith('-t');
    const cleanText = text.replace(/--test|-t/gi, '').trim();
    const usernames = this.parseUsernames(cleanText);
    
    console.log(`[DEBUG] isTestMode: ${isTestMode}, usernames: ${JSON.stringify(usernames)}`);
    
    return { isTestMode, usernames };
  }

  // Resolve channel name to channel ID
  async resolveChannelId(client, channelName) {
    try {
      // Remove # prefix if present
      const cleanChannelName = channelName.startsWith('#') ? channelName.substring(1) : channelName;
      
      // Try to get channel info by name
      const result = await client.conversations.list({
        types: 'public_channel,private_channel'
      });
      
      if (result.ok && result.channels) {
        const channel = result.channels.find(ch => ch.name === cleanChannelName);
        if (channel) {
          console.log(`Found channel ${cleanChannelName} with ID: ${channel.id}`);
          return channel.id;
        }
      }
      
      console.error(`Channel ${cleanChannelName} not found`);
      return null;
    } catch (error) {
      console.error(`Error resolving channel ${channelName}:`, error);
      return null;
    }
  }

  // Main handler for birthday command
  // client: client to use for posting messages (may be userClient or bot client)
  // botClient: always the bot client (for DM/channel operations that need bot scopes)
  async handleBirthdayCommand(ack, respond, command, client, botClient = null) {
    // If botClient not provided, use client (backwards compatibility)
    const dmClient = botClient || client;
    try {
      // Acknowledge the command
      await ack();
      

      // Parse command for test mode and usernames
      const { isTestMode, usernames } = this.parseCommand(command.text);
      
      if (usernames.length === 0) {
        await respond({
          text: `🚀 Please provide at least one username to celebrate! Usage: \`/birthdayboi @username1, @username2\`\n\nAdd \`--test\` or \`-t\` to test in your DM instead of posting to #announcements.`,
          response_type: "ephemeral"
        });
        return;
      }

      // Get message template and format it
      const template = this.getMessageTemplate(usernames.length);
      const message = this.formatMessage(template, usernames);
      
      // Get reactions to add
      const reactions = this.getReactions();
      console.log(`Generated reactions: ${JSON.stringify(reactions)}`);

      // Determine target channel: #announcements for normal mode, user DM for test mode
      let targetChannel;
      console.log(`[DEBUG] isTestMode: ${isTestMode}, user_id: ${command.user_id}`);
      
      if (isTestMode) {
        // Test mode: post to user's DM
        // Always use bot client for opening DMs (has im:write scope)
        console.log(`[DEBUG] Entering test mode - attempting to open DM`);
        try {
          const dmResult = await dmClient.conversations.open({
            users: command.user_id
          });
          console.log(`[DEBUG] DM open result:`, JSON.stringify({ ok: dmResult.ok, channel: dmResult.channel?.id, error: dmResult.error }));
          
          if (!dmResult.ok || !dmResult.channel) {
            console.error(`[DEBUG] Failed to open DM:`, dmResult.error);
            await respond({
              text: `❌ Error: Could not open DM with you. Error: ${dmResult.error || 'unknown'}. Please try again.`,
              response_type: "ephemeral"
            });
            return;
          }
          targetChannel = dmResult.channel.id;
          console.log(`[DEBUG] Test mode: posting to user DM ${targetChannel}`);
        } catch (error) {
          console.error('[DEBUG] Exception opening DM:', error);
          await respond({
            text: `❌ Error: Could not open DM. Exception: ${error.message || error}. Please try again.`,
            response_type: "ephemeral"
          });
          return;
        }
      } else {
        // Normal mode: always post to #announcements
        console.log(`[DEBUG] Entering normal mode - posting to #announcements`);
        targetChannel = await this.resolveChannelId(dmClient, '#announcements');
        if (!targetChannel) {
          await respond({
            text: `❌ Error: Could not find the #announcements channel. Please ensure it exists and the bot has access.`,
            response_type: "ephemeral"
          });
          return;
        }
        // Try to ensure the bot is a member of the channel
        try {
          await dmClient.conversations.join({ channel: targetChannel });
        } catch (joinErr) {
          // Ignore already_in_channel or not_allowed errors; continue to try posting/reactions
          console.log(`Join attempt for #announcements (${targetChannel}) result:`, joinErr?.data?.error || 'ok/ignored');
        }
      }
      
      console.log(`[DEBUG] Final targetChannel: ${targetChannel}, isTestMode: ${isTestMode}`);
      
      // Safety check: Never post to #announcements if in test mode
      if (isTestMode && targetChannel) {
        const announcementsId = await this.resolveChannelId(dmClient, '#announcements');
        if (announcementsId && targetChannel === announcementsId) {
          console.error(`[DEBUG] ERROR: Test mode detected but targetChannel is #announcements! Aborting.`);
          await respond({
            text: `❌ Error: Test mode detected but would post to #announcements. This is a bug. Please report this issue.`,
            response_type: "ephemeral"
          });
          return;
        }
      }

      // Add test mode prefix if in test mode
      const finalMessage = isTestMode ? `🧪 **TEST MODE** 🧪\n\n${message}` : message;

      // Get settings from config
      const settings = this.messages.settings || {};
      const postAsUser = settings.postAsUser || false;
      const botName = settings.botName || "Birthday Bot";
      const botIcon = settings.botIcon || ":birthday:";

      // Post to target channel using Web API
      const messageOptions = {
        channel: targetChannel,
        text: finalMessage
      };

      // Configure posting behavior
      if (postAsUser) {
        // Post as the user (requires user token)
        messageOptions.as_user = true;
      } else {
        // Post as bot with custom appearance
        messageOptions.username = botName;
        messageOptions.icon_emoji = botIcon;
      }

      const result = await client.chat.postMessage(messageOptions);

      // Add reactions to the message
      if (result && result.ts) {
        const messageTs = result.ts;
        const reactionChannel = result.channel || targetChannel;
        console.log(`Adding ${reactions.length} reactions to message ${messageTs} in channel ${reactionChannel}`);
        
        // Add reactions with a small delay to avoid rate limiting
        for (let i = 0; i < reactions.length; i++) {
          setTimeout(async () => {
            try {
              await client.reactions.add({
                channel: reactionChannel,
                timestamp: messageTs,
                name: reactions[i]
              });
            } catch (error) {
              console.error(`Error adding reaction ${reactions[i]}:`, error.message || error);
            }
          }, i * 500); // 500ms delay between reactions
        }
      }

      // Show confirmation message
      if (isTestMode) {
        await respond({
          text: `✅ Test message posted to your DM! Remove \`--test\` to post to #announcements.`,
          response_type: "ephemeral"
        });
      } else {
        await respond({
          text: `✅ Birthday message posted to #announcements!`,
          response_type: "ephemeral"
        });
      }

    } catch (error) {
      console.error('Error handling birthday command:', error);
      await respond({
        text: "Sorry, there was an error processing your birthday request. Please try again!",
        response_type: "ephemeral"
      });
    }
  }

  // Reload configuration (useful for updating messages/reactions without restart)
  reloadConfig() {
    this.config.reload();
    this.messages = this.config.messages;
    this.reactions = this.config.reactions;
  }
}

module.exports = BirthdayHandler;
