#!/bin/bash

# Скрипт для автоматического push в GitHub репозиторий solana-bundler
# Использование: ./push-to-github.sh

set -e

echo "🚀 Pushing Solana Bundler to GitHub..."

# Проверка что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the solana-bundler directory?"
    exit 1
fi

# Проверка что git инициализирован
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git config user.name "dezintegro"
    git config user.email "dezintegro@users.noreply.github.com"
fi

# Проверка коммитов
COMMITS=$(git log --oneline 2>/dev/null | wc -l)
if [ "$COMMITS" -eq 0 ]; then
    echo "📝 Creating initial commit..."
    git add -A
    git commit -m "Initial commit: Solana Token Launch Bundler - Planning Complete

Project Setup Complete with full documentation and configuration.

Documentation:
- PRD.md - Complete product requirements (v1.1)
- COMPETITIVE_ANALYSIS.md - Analysis of 4+ existing solutions
- IMPLEMENTATION_PLAN.md - Detailed 3-week implementation plan
- README.md - Project overview and quick start

Configuration:
- package.json - All dependencies configured
- tsconfig.json - Strict TypeScript setup
- .env.example - Environment template
- .gitignore - Security-focused

Critical Resources:
- idl/pump.json - Official Pumpfun IDL (120KB)
- config/jito-endpoints.json - Regional Jito endpoints
- config/launch-template.json - Launch config template

Key Features:
- LUT (Lookup Tables) - 80% overhead reduction
- jito-js SDK - Official integration
- Bundle Simulation - Prevents failures
- Regional Endpoints - Auto-selection

Status: Planning Complete, Ready for Development"
fi

# Проверка remote
REMOTE=$(git remote -v | grep origin | head -1)
if [ -z "$REMOTE" ]; then
    echo "🔗 Adding GitHub remote..."
    git remote add origin https://github.com/dezintegro/solana-bundler.git
fi

# Переименовать ветку в main
echo "📋 Renaming branch to main..."
git branch -M main

# Push
echo "⬆️  Pushing to GitHub..."
git push -u origin main

echo "✅ Success! Repository pushed to GitHub"
echo "🌐 View at: https://github.com/dezintegro/solana-bundler"
