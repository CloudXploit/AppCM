# Makefile for CM Diagnostics Platform

.PHONY: help dev up down build logs clean install test lint format

# Default target
help:
	@echo "CM Diagnostics Platform - Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Start development environment"
	@echo "  make up         - Start all services with docker-compose"
	@echo "  make down       - Stop all services"
	@echo "  make build      - Build all packages and apps"
	@echo "  make logs       - Show logs from all services"
	@echo "  make clean      - Clean all generated files and containers"
	@echo "  make test       - Run all tests"
	@echo "  make lint       - Run linting"
	@echo "  make format     - Format code"

# Install dependencies
install:
	npm install

# Development
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	npm run dev

# Docker commands
up:
	docker-compose up -d

down:
	docker-compose down

build:
	npm run build

# Logs
logs:
	docker-compose logs -f

# Clean
clean:
	docker-compose down -v
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/*/.next
	rm -rf packages/*/dist
	rm -rf .turbo

# Testing
test:
	npm run test

# Linting
lint:
	npm run lint

# Format
format:
	npm run format

# Database
db-migrate:
	npm run db:migrate --workspace=@cm-diagnostics/database

db-push:
	npm run db:push --workspace=@cm-diagnostics/database

db-studio:
	npm run db:studio --workspace=@cm-diagnostics/database