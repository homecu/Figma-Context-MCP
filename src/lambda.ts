// AWS Lambda handler for MCP server
import serverless from 'serverless-http';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLambdaApp } from './app.js';

// Create the Express app configured for Lambda
let app: any;
let appError: Error | null = null;

try {
  app = createLambdaApp();
} catch (error) {
  appError = error as Error;
  console.error('Failed to create Lambda app:', error);
}

const serverlessHandler = app ? serverless(app) : null;

const handler = async (
  event: APIGatewayProxyEvent, 
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // If app creation failed, return configuration error
    if (appError || !serverlessHandler) {
      console.error('App initialization error:', appError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Configuration error: Missing FIGMA_API_KEY or FIGMA_OAUTH_TOKEN environment variable',
          message: appError?.message || 'Failed to initialize application'
        })
      };
    }

    const result = await serverlessHandler(event, context);
    return result as APIGatewayProxyResult;
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        }
      })
    };
  }
};

// Export for CommonJS (this will be converted during the build process)
exports.handler = handler;