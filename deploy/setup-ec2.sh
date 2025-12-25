#!/bin/bash
set -e

echo "=== RAG Chatbot EC2 Setup Script ==="

sudo dnf update -y

echo "Installing Docker..."
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

echo "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "Installing Git..."
sudo dnf install -y git

echo "Installing Certbot..."
sudo dnf install -y python3 augeas-libs
sudo python3 -m venv /opt/certbot/
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install certbot
sudo ln -sf /opt/certbot/bin/certbot /usr/bin/certbot

echo "Creating app directory..."
sudo mkdir -p /opt/rag-chatbot
sudo chown ec2-user:ec2-user /opt/rag-chatbot

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Log out and back in (for docker group)"
echo "2. Clone your repo: git clone <your-repo> /opt/rag-chatbot"
echo "3. Run: cd /opt/rag-chatbot/deploy && ./deploy.sh"
