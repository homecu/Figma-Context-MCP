#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FigmaMcpServerStack } from './figma-mcp-server-stack.js';

const app = new cdk.App();

new FigmaMcpServerStack(app, 'FigmaMcpServerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Figma MCP Server - Model Context Protocol as a Service (MCPaaS)',
});
