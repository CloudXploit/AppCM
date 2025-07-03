#!/bin/bash

# CM Diagnostics Setup Script
# This script sets up the complete development environment

set -e

echo "🚀 CM Diagnostics Setup Script"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_NODE_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]; then
    print_error "Node.js version $REQUIRED_NODE_VERSION or higher is required. Current version: $NODE_VERSION"
    exit 1
fi
print_success "Node.js version $NODE_VERSION detected"

# Check npm version
print_status "Checking npm version..."
NPM_VERSION=$(npm -v)
REQUIRED_NPM_VERSION="9.0.0"

if [ "$(printf '%s\n' "$REQUIRED_NPM_VERSION" "$NPM_VERSION" | sort -V | head -n1)" != "$REQUIRED_NPM_VERSION" ]; then
    print_error "npm version $REQUIRED_NPM_VERSION or higher is required. Current version: $NPM_VERSION"
    exit 1
fi
print_success "npm version $NPM_VERSION detected"

# Install dependencies
print_status "Installing dependencies..."
npm install

# Build packages
print_status "Building packages..."
npm run build:packages

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p data
mkdir -p uploads
mkdir -p .tmp

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file..."
    cp .env.example .env
    print_warning "Please update .env file with your configuration"
fi

# Check Docker (optional)
if command -v docker &> /dev/null; then
    print_status "Docker detected. Setting up Docker containers..."
    docker-compose build
    print_success "Docker containers built successfully"
else
    print_warning "Docker not found. You'll need to set up databases manually"
fi

# Initialize databases (if Docker is available)
if command -v docker &> /dev/null; then
    print_status "Starting database containers..."
    docker-compose up -d postgres redis elasticsearch
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Run database migrations
    print_status "Running database migrations..."
    npm run migrate
fi

# Generate TypeScript types
print_status "Generating TypeScript types..."
npm run type-check

# Run initial tests
print_status "Running tests..."
npm test

print_success "Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your configuration"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Run 'npm run demo' to see the demo application"
echo "4. Visit http://localhost:3000 to access the application"
echo ""
echo "For more information, see README.md"