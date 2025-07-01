#!/bin/bash

# Scooty - Deployment Script
# One-click deployment to Fly.io

set -e

echo "🚀 Starting Scooty deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command -v flyctl &> /dev/null; then
        print_warning "Fly.io CLI not found. Installing..."
        curl -L https://fly.io/install.sh | sh
        export PATH="$HOME/.fly/bin:$PATH"
    fi
    
    print_success "Dependencies check complete"
}

# Install dependencies
install_dependencies() {
    print_status "Installing npm dependencies..."
    npm ci
    print_success "Dependencies installed"
}

# Build the project
build_project() {
    print_status "Building TypeScript project..."
    npm run build
    print_success "Build complete"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    npm test
    print_success "Tests passed"
}

# Setup Supabase (if needed)
setup_supabase() {
    print_status "Setting up Supabase database..."
    
    # Check if Supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        print_warning "Supabase CLI not found. Please install it manually:"
        echo "npm install -g supabase"
        echo "Then run: supabase login"
        return
    fi
    
    # Push database schema
    if [ -f "supabase/schema.sql" ]; then
        supabase db push
        print_success "Database schema updated"
    else
        print_warning "No schema.sql found. Please create your database manually."
    fi
}

# Deploy to Fly.io
deploy_to_fly() {
    print_status "Deploying to Fly.io..."
    
    # Check if app exists
    if ! flyctl apps list | grep -q "scooty"; then
        print_status "Creating new Fly.io app..."
        flyctl launch --name scooty --region cdg --no-deploy
    fi
    
    # Set secrets
    print_status "Setting environment secrets..."
    
    if [ -n "$DISCORD_TOKEN" ]; then
        flyctl secrets set DISCORD_TOKEN="$DISCORD_TOKEN"
    else
        print_warning "DISCORD_TOKEN not set. Please set it manually:"
        echo "flyctl secrets set DISCORD_TOKEN=your_token"
    fi
    
    if [ -n "$SUPABASE_URL" ]; then
        flyctl secrets set SUPABASE_URL="$SUPABASE_URL"
    else
        print_warning "SUPABASE_URL not set. Please set it manually:"
        echo "flyctl secrets set SUPABASE_URL=your_url"
    fi
    
    if [ -n "$SUPABASE_ANON_KEY" ]; then
        flyctl secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
    else
        print_warning "SUPABASE_ANON_KEY not set. Please set it manually:"
        echo "flyctl secrets set SUPABASE_ANON_KEY=your_key"
    fi
    
    # Deploy
    flyctl deploy --remote-only
    
    print_success "Deployment complete!"
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    # Wait for deployment to be ready
    sleep 30
    
    # Check if app is responding
    if curl -f https://scooty.fly.dev/health &> /dev/null; then
        print_success "Health check passed! Bot is online."
    else
        print_warning "Health check failed. Bot might still be starting up."
    fi
}

# Main deployment flow
main() {
    echo "🟣 Scooty - Deployment Script"
    echo "=================================="
    
    check_dependencies
    install_dependencies
    build_project
    run_tests
    setup_supabase
    deploy_to_fly
    health_check
    
    echo ""
    print_success "🎉 Deployment completed successfully!"
    echo ""
    echo "📊 Your bot is now available at:"
    echo "   https://scooty.fly.dev"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Configure your Discord bot token"
    echo "   2. Set up your Supabase database"
    echo "   3. Invite the bot to your Discord server"
    echo "   4. Test the commands!"
    echo ""
    echo "📚 Documentation: README.md"
}

# Run main function
main "$@" 