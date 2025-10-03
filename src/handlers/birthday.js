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
    const isTestMode = text.toLowerCase().includes('--test') || text.toLowerCase().includes('-t');
    const cleanText = text.replace(/--test|-t/gi, '').trim();
    const usernames = this.parseUsernames(cleanText);
    
    return { isTestMode, usernames };
  }

  // Main handler for birthday command
  async handleBirthdayCommand(ack, respond, command, client) {
    try {
      // Acknowledge the command
      await ack();

      // Parse command for test mode and usernames
      const { isTestMode, usernames } = this.parseCommand(command.text);
      
      if (usernames.length === 0) {
        await respond({
          text: "Please provide at least one username to celebrate! Usage: `/birthdaybot @username1, @username2`\n\nAdd `--test` or `-t` to test in this channel instead of #announcements.",
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

      // Determine target channel
      const targetChannel = isTestMode ? command.channel_id : "#announcements";

      // Add test mode indicator to message
      const finalMessage = isTestMode 
        ? `🧪 **TEST MODE** 🧪\n${message}` 
        : message;

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
        console.log(`Adding ${reactions.length} reactions to message ${messageTs} in channel ${targetChannel}`);
        
        // Add reactions with a small delay to avoid rate limiting
        for (let i = 0; i < reactions.length; i++) {
          setTimeout(async () => {
            try {
              console.log(`Adding reaction: ${reactions[i]}`);
              await client.reactions.add({
                channel: targetChannel,
                timestamp: messageTs,
                name: reactions[i]
              });
              console.log(`Successfully added reaction: ${reactions[i]}`);
            } catch (error) {
              console.error(`Error adding reaction ${reactions[i]}:`, error);
            }
          }, i * 500); // 500ms delay between reactions
        }
      } else {
        console.log('No message timestamp found, cannot add reactions');
      }

      // Show confirmation message in test mode
      if (isTestMode) {
        await respond({
          text: `✅ Test message posted to this channel! Remove \`--test\` to post to #announcements.`,
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
