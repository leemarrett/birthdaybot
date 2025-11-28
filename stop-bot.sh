#!/bin/bash
# Script to stop any running local instances of the Slack birthday bot

echo "Checking for running bot processes..."

# Check for bot.js processes
BOT_PIDS=$(pgrep -f "src/bot.js")
if [ -n "$BOT_PIDS" ]; then
    echo "Found bot.js processes: $BOT_PIDS"
    kill $BOT_PIDS
    echo "✓ Stopped bot.js processes"
else
    echo "✓ No bot.js processes running"
fi

# Check for nodemon processes
NODEMON_PIDS=$(pgrep -f "nodemon")
if [ -n "$NODEMON_PIDS" ]; then
    echo "Found nodemon processes: $NODEMON_PIDS"
    kill $NODEMON_PIDS
    echo "✓ Stopped nodemon processes"
else
    echo "✓ No nodemon processes running"
fi

# Check for Docker containers
DOCKER_CONTAINERS=$(docker ps -a --filter "name=birthday" --format "{{.ID}}" 2>/dev/null)
if [ -n "$DOCKER_CONTAINERS" ]; then
    echo "Found Docker containers: $DOCKER_CONTAINERS"
    docker stop $DOCKER_CONTAINERS 2>/dev/null
    echo "✓ Stopped Docker containers"
else
    echo "✓ No Docker containers running"
fi

# Check ports
if lsof -i :3000 -i :3001 2>/dev/null | grep -q LISTEN; then
    echo "⚠ Warning: Processes still listening on ports 3000 or 3001"
    lsof -i :3000 -i :3001 2>/dev/null
else
    echo "✓ Ports 3000 and 3001 are free"
fi

echo ""
echo "Bot check complete! Safe to test on server."
