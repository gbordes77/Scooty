#!/bin/bash

# Scooty - Quick Start Script
# Pour le développement local

echo "🟣 Scooty - Quick Start"
echo "=============================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy env.example to .env and configure your variables:"
    echo "cp env.example .env"
    echo ""
    echo "Required variables:"
    echo "- DISCORD_TOKEN"
    echo "- CLIENT_ID"
    echo "- GUILD_ID"
    echo "- SUPABASE_URL"
    echo "- SUPABASE_ANON_KEY"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building TypeScript..."
npm run build

# Start the bot
echo "🚀 Starting Scooty..."
echo "Press Ctrl+C to stop"
echo ""

npm run dev 