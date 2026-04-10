const ConfigManager = require('../utils/config');

class BirthdayHandler {
  constructor() {
    this.config = new ConfigManager();
    this.messages = this.config.loadMessages();
    this.reactions = this.config.loadReactions();
    this._membersCache = null;
  }

  /**
   * Slack slash commands often send plain @handle (no user ID). Mentions in messages use
   * <@USERID> or <@USERID|label>. A naive /@(\w+)/g match can pick the wrong @ (e.g. emails,
   * labels) or treat a substring as the whole handle — resolve handles against the workspace.
   */
  static SLACK_USER_MENTION_RE =
    /<@([UW][A-Z0-9]+)(?:\|[^>]+)?>|(?<![a-zA-Z0-9.])@([a-z0-9._-]+)/gi;

  async getAllMembers(client) {
    const ttlMs = 5 * 60 * 1000;
    if (this._membersCache && Date.now() < this._membersCache.expiresAt) {
      return this._membersCache.members;
    }
    const members = [];
    let cursor;
    do {
      const r = await client.users.list({ limit: 200, cursor });
      if (!r.ok) {
        throw new Error(r.error || 'users.list failed');
      }
      members.push(...(r.members || []));
      cursor = r.response_metadata?.next_cursor;
    } while (cursor);
    this._membersCache = { members, expiresAt: Date.now() + ttlMs };
    return members;
  }

  matchMemberByHandle(members, handle) {
    const h = handle.toLowerCase();
    const active = members.filter((m) => !m.deleted && !m.is_bot);
    const byName = active.filter((m) => m.name && m.name.toLowerCase() === h);
    if (byName.length === 1) return byName[0].id;
    const byDn = active.filter(
      (m) => m.profile?.display_name && m.profile.display_name.toLowerCase() === h
    );
    if (byDn.length === 1) return byDn[0].id;
    const byRn = active.filter(
      (m) => m.profile?.real_name && m.profile.real_name.toLowerCase() === h
    );
    if (byRn.length === 1) return byRn[0].id;
    return null;
  }

  /**
   * Returns ordered user IDs and any @handles that could not be resolved.
   */
  async resolveMentionedUserIds(botClient, text) {
    if (!text || text.trim() === '') {
      return { userIds: [], unresolvedHandles: [] };
    }

    const re = new RegExp(BirthdayHandler.SLACK_USER_MENTION_RE.source, 'gi');
    const tokens = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) {
        tokens.push({ type: 'id', value: m[1] });
      } else if (m[2]) {
        const raw = m[2];
        const low = raw.toLowerCase();
        if (['here', 'channel', 'everyone'].includes(low)) continue;
        tokens.push({ type: 'handle', value: raw });
      }
    }

    if (tokens.length === 0) {
      return { userIds: [], unresolvedHandles: [] };
    }

    const needsDirectory = tokens.some((t) => t.type === 'handle');
    let members = null;
    if (needsDirectory) {
      members = await this.getAllMembers(botClient);
    }

    const userIds = [];
    const seen = new Set();
    const unresolvedHandles = [];

    for (const t of tokens) {
      if (t.type === 'id') {
        if (!seen.has(t.value)) {
          seen.add(t.value);
          userIds.push(t.value);
        }
        continue;
      }
      const uid = this.matchMemberByHandle(members, t.value);
      if (uid && !seen.has(uid)) {
        seen.add(uid);
        userIds.push(uid);
      } else if (!uid) {
        unresolvedHandles.push(t.value);
      }
    }

    return { userIds, unresolvedHandles };
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

  // Format message with user mentions (userIds are Slack member IDs, e.g. U…)
  formatMessage(template, userIds) {
    let message = template;
    
    // Replace placeholders with actual user mentions
    userIds.forEach((userId, index) => {
      const mention = `<@${userId}>`;
      
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

  // Parse command text for test mode; resolve mentions to user IDs (async)
  async parseCommand(botClient, text) {
    console.log(`[DEBUG] Raw command text: "${text}"`);
    
    if (!text) {
      console.log(`[DEBUG] Command text is empty or undefined`);
      return { isTestMode: false, userIds: [], unresolvedHandles: [] };
    }
    
    const lowerText = text.toLowerCase();
    const isTestMode = lowerText.includes('--test') || lowerText.includes('-t') || lowerText.trim().startsWith('--test') || lowerText.trim().startsWith('-t');
    const cleanText = text.replace(/--test|-t/gi, '').trim();
    const { userIds, unresolvedHandles } = await this.resolveMentionedUserIds(botClient, cleanText);
    
    console.log(`[DEBUG] isTestMode: ${isTestMode}, userIds: ${JSON.stringify(userIds)}, unresolvedHandles: ${JSON.stringify(unresolvedHandles)}`);
    
    return { isTestMode, userIds, unresolvedHandles };
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
  // userClient: the user client if available (for fallback reactions)
  async handleBirthdayCommand(ack, respond, command, client, botClient = null, userClient = null) {
    // If botClient not provided, use client (backwards compatibility)
    const dmClient = botClient || client;
    try {
      // Acknowledge the command
      await ack();
      

      // Parse command for test mode and resolve @mentions to Slack user IDs
      const { isTestMode, userIds, unresolvedHandles } = await this.parseCommand(dmClient, command.text);
      
      if (unresolvedHandles.length > 0) {
        await respond({
          text: `❌ Could not match these to workspace members (try the @ mention picker, or use each person's Slack *handle* / display name exactly): ${unresolvedHandles.map((h) => `\`@${h}\``).join(', ')}`,
          response_type: "ephemeral"
        });
        return;
      }

      if (userIds.length === 0) {
        await respond({
          text: `🚀 Please provide at least one username to celebrate! Usage: \`/birthdayboi @username1, @username2\`\n\nAdd \`--test\` or \`-t\` to test in your DM instead of posting to #announcements.`,
          response_type: "ephemeral"
        });
        return;
      }

      // Get message template and format it
      const template = this.getMessageTemplate(userIds.length);
      const message = this.formatMessage(template, userIds);
      
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
      
      // Safety check: Verify we're not posting to #announcements in test mode
      // (DM channel IDs start with 'D', public channels start with 'C')
      if (isTestMode && targetChannel && !targetChannel.startsWith('D')) {
        console.error(`[DEBUG] ERROR: Test mode detected but targetChannel doesn't look like a DM! Channel: ${targetChannel}`);
        await respond({
          text: `❌ Error: Test mode detected but target channel is not a DM. This is a bug. Please report this issue.`,
          response_type: "ephemeral"
        });
        return;
      }

      // Add test mode prefix if in test mode
      const finalMessage = isTestMode ? `🧪 **TEST MODE** 🧪\n\n${message}` : message;

      // Get settings from config
      const settings = this.messages.settings || {};
      const postAsUser = settings.postAsUser || false;
      const botName = settings.botName || "Birthday Bot";
      const botIcon = settings.botIcon || ":birthday:";

      // Post to target channel using Web API
      // In test mode (DMs), always use bot client as DMs require bot permissions
      // In normal mode, use the configured client (userClient if postAsUser is enabled)
      const postingClient = isTestMode ? dmClient : client;
      
      const messageOptions = {
        channel: targetChannel,
        text: finalMessage
      };

      // Configure posting behavior
      // Note: In test mode, we always post as bot (DMs don't support as_user)
      if (postAsUser && !isTestMode) {
        // Post as the user (requires user token, only in normal mode)
        messageOptions.as_user = true;
      } else {
        // Post as bot with custom appearance
        messageOptions.username = botName;
        messageOptions.icon_emoji = botIcon;
      }

      console.log(`[DEBUG] Posting message using ${isTestMode ? 'bot client' : (postAsUser ? 'user client' : 'bot client')} to channel ${targetChannel}`);
      const result = await postingClient.chat.postMessage(messageOptions);
      console.log(`[DEBUG] Posted message using ${userClient && postingClient === userClient ? 'userClient' : 'botClient'}`);

      // Add reactions to the message - use the same client that posted the message
      // This ensures if userClient was used for posting, it's also used for reactions
      const reactionClient = postingClient; // Same client used for posting
      if (result && result.ts) {
        const messageTs = result.ts;
        const resultChannel = result.channel;
        const reactionChannel = resultChannel || targetChannel;
        console.log(`Adding ${reactions.length} reactions to message ${messageTs} in channel ${reactionChannel}`);
        console.log(`[DEBUG] Using ${userClient && reactionClient === userClient ? 'userClient' : 'botClient'} for reactions`);
        
        // Add reactions with a small delay to avoid rate limiting
        for (let i = 0; i < reactions.length; i++) {
          setTimeout(async () => {
            try {
              console.log(`Adding reaction: ${reactions[i]}`);
              await reactionClient.reactions.add({
                channel: reactionChannel,
                timestamp: messageTs,
                name: reactions[i]
              });
              console.log(`Successfully added reaction: ${reactions[i]}`);
            } catch (error) {
              const errorCode = error?.data?.error || error?.error || 'unknown';
              console.error(`Error adding reaction ${reactions[i]}:`, error);
              
              // Handle both channel_not_found and not_in_channel errors
              if (errorCode === 'channel_not_found' || errorCode === 'not_in_channel') {
                console.error(`Channel access issue (${errorCode}) for reactions. Attempting to join channel...`);
                console.error(`DEBUG: Tried channel: ${reactionChannel}, original targetChannel: ${targetChannel}, resultChannel: ${resultChannel}`);
                
                // Try to join the channel using botClient if available, otherwise use client
                const joinClient = botClient || client;
                if (reactionChannel.startsWith('C') || reactionChannel.startsWith('G')) {
                  try {
                    console.log(`Attempting to join channel ${reactionChannel} using ${botClient ? 'botClient' : 'client'}...`);
                    await joinClient.conversations.join({ channel: reactionChannel });
                    console.log(`Successfully joined channel ${reactionChannel}`);
                    
                    // Retry the reaction after joining (use the same client that posted)
                    setTimeout(async () => {
                      try {
                        await reactionClient.reactions.add({
                          channel: reactionChannel,
                          timestamp: messageTs,
                          name: reactions[i]
                        });
                        console.log(`Successfully added reaction ${reactions[i]} after joining channel`);
                      } catch (retryError) {
                        const retryErrorCode = retryError?.data?.error || retryError?.error || 'unknown';
                        console.error(`Still failed to add reaction ${reactions[i]} after joining channel (${retryErrorCode}):`, retryError);
                      }
                    }, 1000);
                  } catch (joinError) {
                    const joinErrorCode = joinError?.data?.error || joinError?.error || 'unknown';
                    console.error(`Failed to join channel ${reactionChannel} (${joinErrorCode}):`, joinError);
                    
                    // If join failed and we're using userClient, try using userClient for reactions
                    // (user might be in channel even if bot isn't)
                    if (userClient && reactionClient !== userClient) {
                      console.log(`Retrying reaction with userClient since bot join failed...`);
                      setTimeout(async () => {
                        try {
                          await userClient.reactions.add({
                            channel: reactionChannel,
                            timestamp: messageTs,
                            name: reactions[i]
                          });
                          console.log(`Successfully added reaction ${reactions[i]} using userClient`);
                        } catch (userClientError) {
                          console.error(`Failed to add reaction ${reactions[i]} with userClient:`, userClientError);
                        }
                      }, 1000);
                    }
                  }
                }
              } else {
                // Log other errors but don't retry
                console.error(`Unexpected error adding reaction ${reactions[i]}:`, errorCode);
              }
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
    this._membersCache = null;
  }
}

module.exports = BirthdayHandler;
