// Express app configured for AWS Lambda
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getServerConfig } from './config.js';
import { createServer } from './mcp.js';
import { Logger } from './utils/logger.js';

// Middleware to validate MCP headers
const validateMcpHeaders = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'POST' && req.path === '/mcp') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid request - Content-Type must be application/json'
        }
      });
      return;
    }
  }
  next();
};

// Global error handler for JSON-RPC errors
const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  Logger.error('MCP Error:', err);
  
  res.status(500).json({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: 'Internal server error',
      data: process.env.NODE_ENV === 'development' ? err.message : undefined
    }
  });
};

// MCP Service class to handle requests
class McpService {
  private mcpServer: McpServer | null = null;
  private configError: Error | null = null;

  constructor() {
    try {
      const config = getServerConfig(false); // HTTP mode
      this.mcpServer = createServer(config.auth, { isHTTP: true });
    } catch (error) {
      this.configError = error as Error;
      console.error('MCP Service configuration error:', error);
    }
  }

  async handleRequest(req: Request, res: Response): Promise<void> {
    try {
      if (this.configError || !this.mcpServer) {
        throw new Error(`Configuration error: ${this.configError?.message || 'Failed to initialize MCP server'}`);
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      
      // Clean up when response is closed
      res.on('close', () => {
        transport.close();
      });
      
      await this.mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      Logger.error('Error handling MCP request:', error);
      throw error;
    }
  }
}

// Route handlers
const mcpService = new McpService();

const handlePost = async (req: Request, res: Response): Promise<void> => {
  try {
    await mcpService.handleRequest(req, res);
  } catch (error) {
    Logger.error('POST handler error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error'
      }
    });
  }
};

const handleGet = (req: Request, res: Response): void => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'Method Not Allowed - SSE streaming not implemented in stateless mode'
    }
  });
};

const handleDelete = (req: Request, res: Response): void => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32601,
      message: 'Method Not Allowed - No sessions to terminate in stateless mode'
    }
  });
};

const handleOptions = (req: Request, res: Response): void => {
  res.status(200).end();
};

export const createLambdaApp = (): Express => {
  const app = express();

  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    next();
  });

  // Health check endpoint for deployment monitoring
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      version: process.env.NPM_PACKAGE_VERSION || 'unknown',
      service: 'Figma MCP Server'
    });
  });

  // Parse JSON request bodies
  app.use(express.json());
  
  // Validate MCP headers
  app.use(validateMcpHeaders);
  
  // MCP routes
  app.post('/mcp', handlePost);
  app.get('/mcp', handleGet);
  app.delete('/mcp', handleDelete);
  app.options('/mcp', handleOptions);
  
  // Global error handler
  app.use(errorHandler);

  return app;
};

export default createLambdaApp();
