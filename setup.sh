#!/bin/bash
# Setup script for Local Online Judge

set -e

echo "=== Local Online Judge Setup ==="
echo

# Check Node.js version
echo "Checking Node.js version..."
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 16 ]; then
    echo "❌ Node.js 16+ required. Current version: $(node --version)"
    exit 1
fi
echo "✅ Node.js version: $(node --version)"

# Check MySQL
echo "Checking MySQL..."
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL client not found. Please install MySQL/MariaDB."
    exit 1
fi
echo "✅ MySQL client found"

# Check compilers
echo "Checking compilers..."
if ! command -v g++ &> /dev/null; then
    echo "⚠️  g++ not found. C++ submissions will not work."
else
    echo "✅ g++ found: $(g++ --version | head -n1)"
fi

if ! command -v python3 &> /dev/null; then
    echo "⚠️  python3 not found. Python submissions will not work."
else
    echo "✅ python3 found: $(python3 --version)"
fi

# Install dependencies
echo
echo "Installing Node.js dependencies..."
npm install

# Setup environment
if [ ! -f ".env" ]; then
    echo
    echo "Setting up environment configuration..."
    cp .env.example .env
    
    # Generate session secret
    if command -v openssl &> /dev/null; then
        session_secret=$(openssl rand -base64 32)
        sed -i "s/your_very_secure_session_secret_here_minimum_32_characters/$session_secret/" .env
        echo "✅ Generated secure session secret"
    else
        echo "⚠️  OpenSSL not found. Please manually set SESSION_SECRET in .env"
    fi
    
    echo "📝 Please edit .env file with your database credentials"
else
    echo "✅ .env file already exists"
fi

# Database setup
echo
read -p "Would you like to setup the database now? (y/N): " setup_db
if [[ $setup_db =~ ^[Yy]$ ]]; then
    read -p "Database name [cp_platform]: " db_name
    db_name=${db_name:-cp_platform}
    
    read -p "MySQL username [root]: " db_user
    db_user=${db_user:-root}
    
    read -s -p "MySQL password: " db_password
    echo
    
    echo "Creating database and tables..."
    mysql -u "$db_user" -p"$db_password" -e "CREATE DATABASE IF NOT EXISTS $db_name CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -u "$db_user" -p"$db_password" "$db_name" < init_db.sql
    
    read -p "Install performance indexes? (y/N): " install_indexes
    if [[ $install_indexes =~ ^[Yy]$ ]]; then
        mysql -u "$db_user" -p"$db_password" "$db_name" < optimization_indexes.sql
        echo "✅ Performance indexes installed"
    fi
    
    # Update .env with database credentials
    sed -i "s/DB_NAME=cp_platform/DB_NAME=$db_name/" .env
    sed -i "s/DB_USER=root/DB_USER=$db_user/" .env
    sed -i "s/DB_PASSWORD=your_secure_password_here/DB_PASSWORD=$db_password/" .env
    
    echo "✅ Database setup complete"
fi

# Create necessary directories
echo
echo "Creating necessary directories..."
mkdir -p data/testcases
mkdir -p tmp_runs
mkdir -p tmp/bulk_previews
echo "✅ Directories created"

echo
echo "=== Setup Complete ==="
echo
echo "To start the application:"
echo "  npm start"
echo
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin"
echo
echo "⚠️  IMPORTANT: Change the admin password after first login!"
echo "⚠️  SECURITY: This application executes code without sandboxing."
echo "   Only use in trusted environments!"
echo
echo "Access the application at: http://localhost:3000"