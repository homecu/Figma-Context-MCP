import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FigmaMcpServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda function for the MCP server
    const mcpFunction = new lambda.Function(this, 'FigmaMcpFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist'), {
        exclude: ['*.mjs', '*.mjs.map'], // Exclude the old .mjs files, keep only .js
      }),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      architecture: lambda.Architecture.ARM_64,
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        // Temporary placeholder - replace with your actual Figma API key
        FIGMA_API_KEY: process.env.FIGMA_API_KEY || 'placeholder-key-replace-me'
      }
    });

    // Grant the Lambda function basic execution permissions
    mcpFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: ['*']
    }));

    // HTTP API Gateway
    const mcpApi = new apigatewayv2.HttpApi(this, 'FigmaMcpApi', {
      apiName: 'figma-mcp-server',
      description: 'Figma Model Context Protocol Server API',
      corsPreflight: {
        allowOrigins: ['*'], // Configure this based on your security requirements
        allowHeaders: [
          'Content-Type', 
          'X-Amz-Date', 
          'Authorization', 
          'X-Api-Key', 
          'X-Amz-Security-Token', 
          'X-Amz-User-Agent',
          'Mcp-Session-Id'
        ],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS
        ],
        maxAge: cdk.Duration.hours(1)
      },
      defaultIntegration: new integrations.HttpLambdaIntegration('DefaultIntegration', mcpFunction)
    });

    // Create a Lambda integration for the mcpFunction
    const mcpIntegration = new integrations.HttpLambdaIntegration('FigmaMcpFunctionIntegration', mcpFunction);
    
    // Add routes for MCP endpoints
    mcpApi.addRoutes({
      path: '/mcp',
      methods: [
        apigatewayv2.HttpMethod.POST,
        apigatewayv2.HttpMethod.GET,
        apigatewayv2.HttpMethod.DELETE,
        apigatewayv2.HttpMethod.OPTIONS
      ],
      integration: mcpIntegration
    });

    // Add health check route
    mcpApi.addRoutes({
      path: '/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: mcpIntegration
    });

    // Add a catch-all route for any other paths
    mcpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: mcpIntegration
    });

    // Output the API endpoint URL
    new cdk.CfnOutput(this, 'FigmaMcpApiUrl', {
      value: mcpApi.apiEndpoint,
      description: 'Figma MCP Server API Gateway URL',
      exportName: 'FigmaMcpApiUrl'
    });

    // Output the MCP endpoint specifically
    new cdk.CfnOutput(this, 'FigmaMcpEndpoint', {
      value: `${mcpApi.apiEndpoint}/mcp`,
      description: 'Figma MCP Server Endpoint URL for client configuration',
      exportName: 'FigmaMcpEndpoint'
    });

    // Output the health check endpoint
    new cdk.CfnOutput(this, 'FigmaMcpHealthEndpoint', {
      value: `${mcpApi.apiEndpoint}/health`,
      description: 'Health check endpoint for monitoring',
      exportName: 'FigmaMcpHealthEndpoint'
    });
  }
}
