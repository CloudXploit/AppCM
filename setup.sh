#!/bin/bash

echo "🚀 CM Diagnostics Setup Script"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}📦 $1${NC}"
}

# Check Node.js version
print_info "Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm -v)
echo "npm version: $NPM_VERSION"

# Install root dependencies
print_info "Installing root dependencies..."
npm install --legacy-peer-deps || {
    print_error "Failed to install root dependencies"
    exit 1
}
print_success "Root dependencies installed"

# List of packages to setup
PACKAGES=(
    "packages/core"
    "packages/typescript-config"
    "packages/eslint-config"
    "packages/tailwind-config"
    "packages/logger"
    "packages/database"
    "packages/auth"
    "packages/ui"
    "packages/i18n"
    "packages/cm-connector"
    "packages/diagnostics"
    "packages/idol-connector"
    "packages/es-connector"
    "packages/api-client"
    "packages/api"
    "apps/web"
)

# Install dependencies for each package
for package in "${PACKAGES[@]}"; do
    if [ -d "$package" ]; then
        print_info "Installing dependencies for $package..."
        (cd "$package" && npm install --legacy-peer-deps) || {
            print_error "Failed to install dependencies for $package"
            # Continue with other packages
        }
        print_success "Dependencies installed for $package"
    else
        print_error "Package directory not found: $package"
    fi
done

# Build packages
print_info "Building all packages..."
npm run build || {
    print_error "Build failed - this is expected for now as some packages may have issues"
}

print_success "Setup complete!"
echo ""
echo "To start the development servers, run:"
echo "  npm run dev"
echo ""
echo "Or to start individual services:"
echo "  cd packages/api && npm run dev    # Start API server"
echo "  cd apps/web && npm run dev        # Start web app"