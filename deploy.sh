#!/bin/bash

# Figma MCP Server Deployment Script
# This script deploys the Figma MCP Server to AWS as a service

set -e

echo "🚀 Starting Figma MCPaaS Deployment..."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed. Aborting." >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }

# Check if AWS credentials are configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Check for FIGMA_API_KEY environment variable
if [ -z "$FIGMA_API_KEY" ]; then
    echo "⚠️  FIGMA_API_KEY environment variable not set."
    echo "   Please set it before deploying:"
    echo "   export FIGMA_API_KEY='your-figma-api-key-here'"
    echo ""
    echo "   You can get a Figma API key from: https://www.figma.com/developers/api#access-tokens"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled. Please set FIGMA_API_KEY and try again."
        exit 1
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build the project
echo "🔨 Building Lambda package..."
pnpm build:lambda

# Deploy infrastructure
echo "☁️ Deploying to AWS..."
pnpm cdk:deploy --require-approval never

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Your MCPaaS endpoints:"
echo "   Health Check: Check the CloudFormation outputs for the health endpoint"
echo "   MCP Endpoint: Check the CloudFormation outputs for the MCP endpoint"
echo ""
echo "💡 Next steps:"
echo "   1. Configure your MCP client with the endpoint URL"
echo "   2. Set up your Figma API token in environment variables"
echo "   3. Test the service with a health check"
echo ""
echo "📚 For detailed usage instructions, see MCPaaS-DEPLOYMENT.md"
