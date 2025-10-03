#!/bin/bash

# Birthday Bot Setup Script
echo "🎉 Setting up Birthday Bot..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ Created .env file"
    echo "⚠️  Please edit .env with your Slack tokens!"
else
    echo "✅ .env file already exists"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Check if config directory exists
if [ ! -d "config" ]; then
    echo "📁 Creating config directory..."
    mkdir -p config
    echo "✅ Config directory created"
else
    echo "✅ Config directory exists"
fi

echo ""
echo "🚀 Setup complete! Next steps:"
echo "1. Edit .env with your Slack tokens (see SLACK_SETUP.md)"
echo "2. Test locally: npm start"
echo "3. Or deploy with Docker: add compose.yaml to Dockge"
echo ""
echo "📖 For detailed setup instructions, see SLACK_SETUP.md"
