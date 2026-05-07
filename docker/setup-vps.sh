#!/bin/bash
# =============================================================================
# LaunchLayer — VPS Initial Setup Script
# Run on a fresh Ubuntu 22.04+ VPS (Hetzner, DigitalOcean, etc.)
#
# Usage: curl -sSL <raw-github-url>/docker/setup-vps.sh | bash
# Or:    scp docker/setup-vps.sh user@vps:~ && ssh user@vps 'bash setup-vps.sh'
# =============================================================================

set -e

echo "================================================="
echo "  LaunchLayer — VPS Setup"
echo "================================================="

# Update system
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
  echo "🐳 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  echo "Docker installed. You may need to log out and back in for group changes."
else
  echo "🐳 Docker already installed"
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
  echo "🐳 Installing Docker Compose plugin..."
  sudo apt-get install -y docker-compose-plugin
else
  echo "🐳 Docker Compose already installed"
fi

# Install Git
if ! command -v git &> /dev/null; then
  echo "📦 Installing Git..."
  sudo apt-get install -y git
fi

# Create app directory
echo "📁 Setting up application directory..."
sudo mkdir -p /opt/launchlayer
sudo chown $USER:$USER /opt/launchlayer

# Clone repository (if not already cloned)
if [ ! -d "/opt/launchlayer/.git" ]; then
  echo "📥 Clone your repository:"
  echo "  cd /opt/launchlayer"
  echo "  git clone https://github.com/YOUR_USER/feature-flags-platform.git ."
  echo ""
else
  echo "📥 Repository already cloned"
fi

# Setup firewall
echo "🔒 Configuring firewall..."
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

# Setup swap (important for small VPS)
if [ ! -f /swapfile ]; then
  echo "💾 Setting up 2GB swap..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  # Optimize swap usage
  echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
  sudo sysctl -p
else
  echo "💾 Swap already configured"
fi

echo ""
echo "================================================="
echo "  Setup complete! Next steps:"
echo "================================================="
echo ""
echo "1. Clone your repo (if not done):"
echo "   cd /opt/launchlayer"
echo "   git clone https://github.com/YOUR_USER/feature-flags-platform.git ."
echo ""
echo "2. Create your .env.production file:"
echo "   cp .env.production.example .env.production"
echo "   nano .env.production"
echo ""
echo "3. Build and start:"
echo "   docker compose -f docker/docker-compose.prod.yml --env-file .env.production build"
echo "   docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d"
echo ""
echo "4. Run initial migration:"
echo "   docker compose -f docker/docker-compose.prod.yml --env-file .env.production run --rm \\"
echo "     api-management sh -c 'cd /app/packages/database && npx prisma migrate deploy'"
echo ""
echo "5. Setup SSL (replace YOUR_DOMAIN):"
echo "   docker compose -f docker/docker-compose.prod.yml exec certbot \\"
echo "     certbot certonly --webroot -w /var/www/certbot -d YOUR_DOMAIN"
echo "   # Then uncomment the HTTPS block in docker/nginx/conf.d/default.conf"
echo "   docker compose -f docker/docker-compose.prod.yml exec nginx nginx -s reload"
echo ""
echo "6. Add GitHub Actions secrets for auto-deploy:"
echo "   VPS_HOST     = your-vps-ip"
echo "   VPS_USER     = $USER"
echo "   VPS_SSH_KEY  = (your SSH private key)"
echo ""
