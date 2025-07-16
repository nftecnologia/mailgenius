#!/bin/bash

# Script to fix logging issues in MailGenius project
# This script will replace console.log statements with proper logging

echo "🔧 Starting logging fix for MailGenius project..."

# Create backup directory
mkdir -p ./logs-backup

# Find all TypeScript and JavaScript files with console.log
FILES=$(find src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | grep -v ".next" | grep -v dist)

echo "📁 Found $(echo "$FILES" | wc -l) files to check..."

for file in $FILES; do
    if grep -q "console\." "$file"; then
        echo "🔍 Processing: $file"
        
        # Create backup
        cp "$file" "./logs-backup/$(basename "$file").backup"
        
        # Add logger import if not present and has console statements
        if ! grep -q "import.*logger" "$file"; then
            # Add import after the last import or at the top
            sed -i "1i import { logger } from '@/lib/logger'" "$file"
        fi
        
        # Replace console.log with logger.info
        sed -i "s/console\.log(/logger.info(/g" "$file"
        
        # Replace console.error with logger.error
        sed -i "s/console\.error(/logger.error(/g" "$file"
        
        # Replace console.warn with logger.warn
        sed -i "s/console\.warn(/logger.warn(/g" "$file"
        
        # Replace console.debug with logger.debug
        sed -i "s/console\.debug(/logger.debug(/g" "$file"
        
        echo "✅ Updated: $file"
    fi
done

echo "🎉 Logging fix completed!"
echo "📦 Backups stored in: ./logs-backup/"
echo ""
echo "🚨 IMPORTANT: Please review the changes and:"
echo "1. Check for any compilation errors"
echo "2. Test the application functionality"
echo "3. Adjust log levels as needed"
echo "4. Configure environment variables for production"