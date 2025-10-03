const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, '../../config');
    this.messagesPath = path.join(this.configPath, 'messages.json');
    this.reactionsPath = path.join(this.configPath, 'reactions.json');
  }

  // Load messages configuration
  loadMessages() {
    try {
      const data = fs.readFileSync(this.messagesPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading messages config:', error);
      return this.getDefaultMessages();
    }
  }

  // Load reactions configuration
  loadReactions() {
    try {
      const data = fs.readFileSync(this.reactionsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading reactions config:', error);
      return this.getDefaultReactions();
    }
  }

  // Get default messages if config file is missing
  getDefaultMessages() {
    return {
      single: ["Happy birthday, {user}! 🎉"],
      double: ["Happy birthday, {user1} and {user2}! 🎉"],
      multiple: ["Happy birthday to {user1}, {user2}, and {user3}! 🎉"]
    };
  }

  // Get default reactions if config file is missing
  getDefaultReactions() {
    return {
      favorites: ["🎉", "🎂", "🎈", "🥳"],
      additional: ["🎊", "🎁", "✨", "🌟"]
    };
  }

  // Reload configuration (useful for hot-reloading in development)
  reload() {
    this.messages = this.loadMessages();
    this.reactions = this.loadReactions();
  }
}

module.exports = ConfigManager;
