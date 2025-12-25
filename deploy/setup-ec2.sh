#!/bin/bash
set -e

echo "=== RAG Chatbot EC2 Setup Script ==="

sudo apt-get update -y
sudo apt-get upgrade -y

echo "Installing Docker..."
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

echo "Installing Git..."
sudo apt-get install -y git

echo "Installing Certbot..."
sudo apt-get install -y certbot

echo "Creating app directory..."
sudo mkdir -p /opt/rag-chatbot
sudo chown ubuntu:ubuntu /opt/rag-chatbot

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Log out and back in (for docker group)"
echo "2. Clone your repo: git clone <your-repo> /opt/rag-chatbot"
echo "3. Run: cd /opt/rag-chatbot/deploy && DOMAIN=yourdomain.com ./deploy.sh"
