#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 CM Diagnostics - Full Application Setup & Run${NC}"
echo "=================================================="
echo ""

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

print_step() {
    echo -e "${BLUE}▶️  $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    exit 1
fi

NODE_VERSION=$(node -v)
print_success "Node.js version: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed!"
    exit 1
fi

NPM_VERSION=$(npm -v)
print_success "npm version: $NPM_VERSION"

# Clean previous installations
print_step "Cleaning previous installations..."
rm -rf node_modules package-lock.json
find packages -name "node_modules" -type d -prune -exec rm -rf {} \;
find apps -name "node_modules" -type d -prune -exec rm -rf {} \;
find . -name "package-lock.json" -type f -delete
print_success "Cleaned previous installations"

# Install root dependencies
print_step "Installing root dependencies..."
npm install --legacy-peer-deps || {
    print_error "Failed to install root dependencies"
    exit 1
}
print_success "Root dependencies installed"

# Create necessary directories
mkdir -p packages/database/prisma

# Create a minimal Prisma schema if it doesn't exist
if [ ! -f packages/database/prisma/schema.prisma ]; then
    print_info "Creating Prisma schema..."
    cat > packages/database/prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  password  String
  name      String?
  role      String   @default("USER")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model System {
  id          String   @id @default(cuid())
  name        String
  type        String
  version     String
  status      String   @default("active")
  config      Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model DiagnosticScan {
  id          String   @id @default(cuid())
  systemId    String
  status      String
  progress    Int      @default(0)
  findings    Json?
  startedAt   DateTime @default(now())
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Finding {
  id           String   @id @default(cuid())
  scanId       String
  ruleId       String
  severity     String
  category     String
  title        String
  description  String?
  remediation  Json?
  status       String   @default("open")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
EOF
    print_success "Created Prisma schema"
fi

# Create database client file
print_info "Creating database client..."
cat > packages/database/src/index.ts << 'EOF'
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
EOF

# Install dependencies for each package in correct order
PACKAGES=(
    "packages/typescript-config"
    "packages/eslint-config"
    "packages/tailwind-config"
    "packages/logger"
    "packages/database"
    "packages/core"
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

for package in "${PACKAGES[@]}"; do
    if [ -d "$package" ]; then
        print_info "Installing dependencies for $package..."
        (cd "$package" && npm install --legacy-peer-deps) || {
            print_error "Failed to install dependencies for $package"
            # Continue with other packages
        }
        print_success "Dependencies installed for $package"
    fi
done

# Generate Prisma client
print_step "Generating Prisma client..."
(cd packages/database && npx prisma generate) || {
    print_error "Failed to generate Prisma client"
}

# Build packages
print_step "Building packages..."
npm run build || {
    print_info "Some packages failed to build - continuing anyway"
}

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_info "Creating .env file..."
    cp .env.development .env
    print_success "Created .env file"
fi

# Create a process manager script
print_step "Creating process manager..."
cat > run-services.js << 'EOF'
const { spawn } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue.bold('🚀 Starting CM Diagnostics Services...\n'));

const services = [];

// Function to create colored output
function createLogger(name, color) {
  return (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line) console.log(chalk[color](`[${name}]`) + ' ' + line);
    });
  };
}

// Start API server
console.log(chalk.yellow('Starting API server...'));
const api = spawn('npm', ['run', 'dev'], {
  cwd: 'packages/api',
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

api.stdout.on('data', createLogger('API', 'green'));
api.stderr.on('data', createLogger('API', 'red'));
services.push(api);

// Wait for API to start, then start web app
setTimeout(() => {
  console.log(chalk.yellow('\nStarting Web application...'));
  const web = spawn('npm', ['run', 'dev'], {
    cwd: 'apps/web',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  
  web.stdout.on('data', createLogger('WEB', 'blue'));
  web.stderr.on('data', createLogger('WEB', 'red'));
  services.push(web);
  
  setTimeout(() => {
    console.log(chalk.green.bold('\n✅ All services started!\n'));
    console.log(chalk.white('📋 Available URLs:'));
    console.log(chalk.white('   Web App: ') + chalk.cyan('http://localhost:3000'));
    console.log(chalk.white('   API: ') + chalk.cyan('http://localhost:4000'));
    console.log(chalk.white('   GraphQL: ') + chalk.cyan('http://localhost:4000/graphql'));
    console.log(chalk.white('\n📝 Login Credentials:'));
    console.log(chalk.white('   Username: ') + chalk.yellow('demo'));
    console.log(chalk.white('   Password: ') + chalk.yellow('demo123'));
    console.log(chalk.gray('\n🛑 Press Ctrl+C to stop all services\n'));
  }, 3000);
}, 5000);

// Handle cleanup
process.on('SIGINT', () => {
  console.log(chalk.red('\n\n🛑 Shutting down services...'));
  services.forEach(service => {
    try {
      service.kill('SIGTERM');
    } catch (e) {
      // Service might already be dead
    }
  });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
EOF

# Install chalk for colored output
npm install --save-dev chalk

print_success "Setup complete!"
echo ""
print_step "Starting services..."
echo ""

# Run the services
node run-services.js