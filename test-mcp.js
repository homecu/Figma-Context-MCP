#!/usr/bin/env node

/**
 * Test script for the deployed MCP server
 * Usage: node test-mcp.js [method] [params]
 */

const MCP_ENDPOINT = 'https://7otteftqo9.execute-api.us-east-1.amazonaws.com/mcp';

async function testMCP(method = 'tools/list', params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: method,
    params: params
  };

  console.log('🔄 Sending MCP request:');
  console.log(JSON.stringify(request, null, 2));
  console.log('\n📡 Endpoint:', MCP_ENDPOINT);
  console.log('⏳ Waiting for response...\n');

  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Test-Client/1.0.0'
      },
      body: JSON.stringify(request)
    });

    const responseText = await response.text();
    
    console.log('📊 Response Status:', response.status, response.statusText);
    console.log('📋 Response Headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    
    console.log('\n📄 Response Body:');
    
    try {
      const jsonResponse = JSON.parse(responseText);
      console.log(JSON.stringify(jsonResponse, null, 2));
      
      if (jsonResponse.error) {
        console.log('\n❌ Error received:', jsonResponse.error.message);
        if (jsonResponse.error.data) {
          console.log('   Error details:', jsonResponse.error.data);
        }
      } else if (jsonResponse.result) {
        console.log('\n✅ Success! Result received.');
      }
    } catch (parseError) {
      console.log('Raw response (not JSON):', responseText);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Parse command line arguments
const method = process.argv[2] || 'tools/list';
let params = {};

if (process.argv[3]) {
  try {
    params = JSON.parse(process.argv[3]);
  } catch (error) {
    console.error('Invalid JSON params:', process.argv[3]);
    process.exit(1);
  }
}

console.log('🧪 MCP Server Test');
console.log('==================\n');

testMCP(method, params);
