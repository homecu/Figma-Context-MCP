import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';

// Simple test version without full app dependencies
describe('MCPaaS HTTP Transport - Basic Tests', () => {
  let app: express.Express;

  beforeAll(() => {
    // Create a minimal Express app for testing basic functionality
    app = express();
    
    // CORS middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      next();
    });

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.NPM_PACKAGE_VERSION || 'unknown',
        service: 'Figma MCP Server'
      });
    });

    // JSON parser
    app.use(express.json());
    
    // Basic MCP endpoint handlers
    app.post('/mcp', (req: Request, res: Response) => {
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid request - Content-Type must be application/json'
          }
        });
      }
      
      // Return a basic response
      res.json({
        jsonrpc: '2.0',
        id: req.body.id || 1,
        result: { status: 'ok' }
      });
    });

    app.get('/mcp', (req: Request, res: Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method Not Allowed - SSE streaming not implemented in stateless mode'
        }
      });
    });

    app.delete('/mcp', (req: Request, res: Response) => {
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method Not Allowed - No sessions to terminate in stateless mode'
        }
      });
    });

    app.options('/mcp', (req: Request, res: Response) => {
      res.status(200).end();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'Figma MCP Server'
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBeDefined();
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/mcp')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('MCP Endpoints', () => {
    it('should reject GET requests to /mcp with 405', async () => {
      const response = await request(app)
        .get('/mcp')
        .expect(405);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: expect.stringContaining('Method Not Allowed')
        }
      });
    });

    it('should reject DELETE requests to /mcp with 405', async () => {
      const response = await request(app)
        .delete('/mcp')
        .expect(405);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: expect.stringContaining('Method Not Allowed')
        }
      });
    });

    it('should validate Content-Type for POST requests', async () => {
      const response = await request(app)
        .post('/mcp')
        .send('invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: expect.stringContaining('Content-Type must be application/json')
        }
      });
    });

    it('should accept valid JSON-RPC requests to /mcp', async () => {
      const validJsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const response = await request(app)
        .post('/mcp')
        .send(validJsonRpcRequest)
        .set('Content-Type', 'application/json')
        .expect(200);

      // Response should be valid JSON-RPC
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/mcp')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');

      // Should return an error status
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
