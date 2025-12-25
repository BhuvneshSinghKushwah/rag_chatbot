# AWS EC2 Deployment Guide

## Prerequisites

- AWS account
- Domain name (e.g., from Namecheap, GoDaddy, Route 53)
- Your repo pushed to GitHub/GitLab

## Step 1: Launch EC2 Instance

1. Go to AWS Console > EC2 > Launch Instance
2. Configure:
   - **Name**: rag-chatbot
   - **AMI**: Ubuntu Server 24.04 LTS
   - **Instance type**: t3.medium (minimum) or t3.large (recommended)
   - **Key pair**: Create new or use existing
   - **Security Group**: Create with these rules:
     - SSH (22) - Your IP
     - HTTP (80) - Anywhere
     - HTTPS (443) - Anywhere
   - **Storage**: 30 GB gp3

3. Launch and note the **Public IP**

## Step 2: Configure Domain

### Option A: Using Route 53

1. Go to Route 53 > Hosted Zones
2. Create hosted zone for your domain (if not exists)
3. Create A record:
   - Name: (leave empty for root, or `chat` for subdomain)
   - Type: A
   - Value: Your EC2 Public IP
   - TTL: 300

### Option B: Using External DNS (Namecheap, GoDaddy, etc.)

1. Log into your domain registrar
2. Go to DNS settings
3. Add A record:
   - Host: `@` (root) or `chat` (subdomain)
   - Value: Your EC2 Public IP
   - TTL: 300 (or lowest available)

Wait 5-10 minutes for DNS propagation.

## Step 3: Setup EC2

SSH into your instance:

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

Run setup script:

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_REPO/rag_chatbot/master/deploy/setup-ec2.sh | bash
```

Or manually:

```bash
# Update system
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Docker
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

# Install Git
sudo apt-get install -y git

# Install Certbot
sudo apt-get install -y certbot
```

Log out and back in for docker group to take effect:

```bash
exit
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

## Step 4: Clone and Configure

```bash
git clone https://github.com/YOUR_REPO/rag_chatbot.git /opt/rag-chatbot
cd /opt/rag-chatbot
```

Create production environment file:

```bash
cp .env.example .env.prod
nano .env.prod
```

Update these values in `.env.prod`:

```bash
# API Keys (required)
GOOGLE_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key

# Database
POSTGRES_PASSWORD=strong_random_password_here

# Security
SECRET_KEY=generate_random_string_here
ADMIN_API_KEY=your_admin_key
RATE_LIMIT_SALT=another_random_string

# Domain (will be set by deploy script)
CORS_ORIGINS=https://yourdomain.com
```

## Step 5: Deploy

```bash
cd /opt/rag-chatbot/deploy
DOMAIN=yourdomain.com ./deploy.sh
```

This will:
1. Obtain SSL certificate via Let's Encrypt
2. Build all Docker images
3. Start all services

## Step 6: Verify

Visit `https://yourdomain.com` in your browser.

Check logs if issues:

```bash
docker-compose -f /opt/rag-chatbot/deploy/docker-compose.prod.yml logs -f
```

## Maintenance

### View Logs

```bash
cd /opt/rag-chatbot/deploy
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs backend  # specific service
```

### Restart Services

```bash
docker compose -f docker-compose.prod.yml restart
```

### Update Application

```bash
cd /opt/rag-chatbot
git pull
cd deploy
docker compose -f docker-compose.prod.yml up -d --build
```

### Renew SSL Certificate

Certbot auto-renews, but manual renewal:

```bash
sudo certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

### Backup Database

```bash
docker exec support_postgres pg_dump -U support_user support_chat > backup_$(date +%Y%m%d).sql
```

## Cost Estimate

| Resource | Monthly Cost |
|----------|-------------|
| t3.medium EC2 | ~$30 |
| 30 GB EBS | ~$2.50 |
| Data transfer | ~$5-10 |
| **Total** | **~$40/month** |

For lower costs, use t3.small (~$15/mo) but performance may suffer.

## Troubleshooting

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

### Container Won't Start

```bash
# Check container status
docker ps -a

# View specific container logs
docker logs support_backend
```

### Out of Memory

Upgrade to larger instance or add swap:

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

### DNS Not Resolving

```bash
# Check if DNS propagated
nslookup yourdomain.com
dig yourdomain.com
```

Wait up to 48 hours for full propagation (usually 5-30 minutes).
