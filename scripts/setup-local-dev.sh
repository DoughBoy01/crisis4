#!/bin/bash
# Setup script for local development

echo "🚀 Setting up Crisis2 local development environment..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

# Check if local database exists
if [ ! -d ".wrangler/state/v3/d1" ]; then
  echo "🗄️  Initializing local D1 database..."
  npx wrangler d1 execute crisis2-db --local --file=./schemas/0001_initial_schema.sql
  npx wrangler d1 execute crisis2-db --local --file=./schemas/0002_users_table.sql
  echo ""

  echo "👤 Creating local admin user..."
  # Create admin user directly
  npx wrangler d1 execute crisis2-db --local --command="INSERT INTO users (id, email, password_hash, role, active, created_at) VALUES ('6b809706-9f28-44fa-8ac5-7ec88bdb71a8', 'admin@example.com', '\$2a\$10\$PbfZ1nGq.L0xQlFO3aAfI.FMyoWcEs86H83HqbGK55Oy8WCEbUq92', 'admin', 1, datetime('now'));"
  echo ""
else
  echo "✅ Local database already exists"
  echo ""
fi

# Check if .dev.vars exists
if [ ! -f ".dev.vars" ]; then
  echo "⚙️  Creating .dev.vars file..."
  cat > .dev.vars << 'EOF'
# Local Development Environment Variables
JWT_SECRET=local-dev-secret-change-me-in-production

# Optional: Supabase credentials
# VITE_SUPABASE_URL=
# VITE_SUPABASE_ANON_KEY=

# Optional: OpenAI API Key
# OPENAI_API_KEY=
EOF
  echo ""
else
  echo "✅ .dev.vars already exists"
  echo ""
fi

# Build the project
echo "🔨 Building project..."
npm run build
echo ""

echo "✅ Setup complete!"
echo ""
echo "📋 Local Admin Credentials:"
echo "   Email:    admin@example.com"
echo "   Password: LocalAdmin123"
echo ""
echo "🎯 Next steps:"
echo ""
echo "   1. Start development server:"
echo "      npm run dev:full"
echo ""
echo "   2. Open browser:"
echo "      http://localhost:8788"
echo ""
echo "   3. Login with credentials above"
echo ""
echo "📚 See docs/LOCAL-DEVELOPMENT.md for full guide"
echo ""
