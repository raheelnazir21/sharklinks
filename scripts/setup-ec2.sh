#!/bin/bash
# ─────────────────────────────────────────────────────────────
# AWS EC2 Ubuntu - Initial Setup Script
# Installs Docker, Docker Compose, Git, Nginx, and Certbot
# ─────────────────────────────────────────────────────────────

set -e

echo "🚀 Starting system update & package installation..."
sudo apt update && sudo apt upgrade -y

echo "📦 Installing baseline dependencies..."
sudo apt install -y curl git ufw nginx python3-certbot-nginx apt-transport-https ca-certificates gnupg lsb-release

# Install Docker
echo "🐳 Installing Docker Engine..."
if ! command -v docker &> /dev/null; then
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

# Start & Enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Allow current user to run docker commands without sudo
sudo usermod -aG docker $USER

# Install Docker Compose if not already present as v2 command
if ! docker compose version &> /dev/null; then
    echo "🔧 Installing docker-compose v2 standalone CLI..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

echo "🛡️ Configuring Firewall (UFW)..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "✅ Docker details:"
docker --version
docker compose version

echo "🎉 Setup completed successfully!"
echo "⚠️ Please LOG OUT and LOG BACK IN so that your user group changes take effect and you can run 'docker' commands without sudo."
