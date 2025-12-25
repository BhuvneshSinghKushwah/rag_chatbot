#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -z "$DOMAIN" ]; then
    echo "Error: DOMAIN environment variable not set"
    echo "Usage: DOMAIN=yourdomain.com ./deploy.sh"
    exit 1
fi

echo "=== Deploying RAG Chatbot to $DOMAIN ==="

cd "$PROJECT_DIR"

if [ ! -f .env.prod ]; then
    echo "Error: .env.prod not found"
    echo "Copy .env.example to .env.prod and configure it"
    exit 1
fi

echo "Setting up SSL certificate..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    sudo certbot certonly --standalone \
        -d "$DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email admin@"$DOMAIN" \
        --http-01-port 80
fi

echo "Updating nginx config with domain..."
sed "s/\${DOMAIN}/$DOMAIN/g" "$SCRIPT_DIR/nginx.conf" > "$SCRIPT_DIR/nginx.conf.tmp"
mv "$SCRIPT_DIR/nginx.conf.tmp" "$SCRIPT_DIR/nginx.conf.active"

echo "Building and starting services..."
cd "$SCRIPT_DIR"
DOMAIN=$DOMAIN docker-compose -f docker-compose.prod.yml up -d --build

echo ""
echo "=== Deployment Complete ==="
echo "Your app is now running at https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose -f deploy/docker-compose.prod.yml logs -f"
echo "  Restart:   docker-compose -f deploy/docker-compose.prod.yml restart"
echo "  Stop:      docker-compose -f deploy/docker-compose.prod.yml down"
