#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Layer1 Digest Authentication
 * Implementation of RFC 9421 authentication for Layer1 API
 */
class Layer1Digest {
  /**
   * Creates a new Layer1Digest instance
   * 
   * @param {string} signingPrivateKey - Base64 encoded private key
   * @param {string} clientId - OAuth2 Client ID
   */
  constructor(signingPrivateKey, clientId) {
    this.clientId = clientId;
    this.signingKey = this.prepareKey(signingPrivateKey);
  }

  /**
   * Build the necessary signature headers
   * 
   * @param {string} url - The full URL of the request
   * @param {string} payload - The body of the request (if any)
   * @param {string} method - The HTTP method of the request
   * @returns {Object} - A map of headers
   */
  buildHeaders(url, payload, method) {
    const headerParams = {};
    let contentDigest = null;

    if (payload && payload.length > 0) {
      contentDigest = this.createDigest('sha-256', payload);
      headerParams['Content-Digest'] = contentDigest;
    }

    const signatureParameters = this.createSignatureParameters(contentDigest);
    headerParams['Signature-Input'] = `sig=${signatureParameters}`;

    const signatureBase = this.createSignatureBase(method, url, contentDigest, signatureParameters);
    const signature = this.sign(signatureBase);
    headerParams['Signature'] = `sig=:${signature}:`;

    return headerParams;
  }

  /**
   * Create the signature base string
   * 
   * @param {string} method - The HTTP method
   * @param {string} url - The full URL
   * @param {string} contentDigest - The content digest (if any)
   * @param {string} signatureParameters - The signature parameters
   * @returns {string} - The signature base string
   */
  createSignatureBase(method, url, contentDigest, signatureParameters) {
    return `"@method": ${method.toUpperCase()}\n"@target-uri": ${url}\n${
      contentDigest ? `"content-digest": ${contentDigest}\n` : ''
    }"@signature-params": ${signatureParameters}`;
  }

  /**
   * Sign the request using SHA256withRSA
   * 
   * @param {string} signatureBase - The signature base string
   * @returns {string} - The base64 encoded signature
   */
  sign(signatureBase) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureBase);
    sign.end();
    return sign.sign(this.signingKey, 'base64');
  }

  /**
   * Create the RFC 9421 signature parameters
   * 
   * @param {string} contentDigest - The content digest (if any)
   * @returns {string} - The signature parameters
   */
  createSignatureParameters(contentDigest) {
    const components = ['"@method"', '"@target-uri"'];
    if (contentDigest) {
      components.push('"content-digest"');
    }
    
    const created = Math.floor(Date.now() / 1000);
    return `(${components.join(' ')});created=${created};keyid="${this.clientId}";alg="rsa-v1_5-sha256"`;
  }

  /**
   * Create and prepare the digest for the request
   * 
   * @param {string} digestAlgorithm - The digest algorithm to use
   * @param {string} data - The data to digest
   * @returns {string} - The formatted digest
   */
  createDigest(digestAlgorithm, data) {
    const hash = crypto.createHash(digestAlgorithm.replace('sha-', 'sha'));
    hash.update(data);
    const digest = hash.digest('base64');
    return `${digestAlgorithm}=:${digest}:`;
  }

  /**
   * Remove the header and footer from the private key
   * 
   * @param {string} rawKey - The raw private key
   * @returns {string} - The prepared private key
   */
  prepareKey(rawKey) {
    let newKey = rawKey.replace('-----BEGIN PRIVATE KEY-----', '');
    newKey = newKey.replace('-----END PRIVATE KEY-----', '');
    newKey = newKey.replace(/\s+/g, '');
    
    // Return the key with proper PEM format
    return `-----BEGIN PRIVATE KEY-----\n${newKey}\n-----END PRIVATE KEY-----`;
  }
}

class Layer1DigitalMCP {
  constructor() {
    this.server = new Server(
      {
        name: 'layer1-digital-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiBaseUrl = 'https://api.sandbox.layer1.com';
    this.assetPoolId = process.env.LAYER1_ASSET_POOL_ID;
    this.clientId = process.env.LAYER1_CLIENT_ID;
    this.privateKey = process.env.LAYER1_PRIVATE_KEY;

    // Initialize the Layer1Digest for authentication
    this.layer1Digest = new Layer1Digest(this.privateKey, this.clientId);

    this.setupTools();
    this.setupHandlers();
  }

  async makeAuthenticatedRequest(endpoint, method = 'GET', data = null, params = null) {
    try {
      const url = new URL(endpoint, this.apiBaseUrl);
      
      // Add query parameters if provided
      if (params) {
        Object.keys(params).forEach(key => {
          if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key]);
          }
        });
      }

      const fullUrl = url.toString();
      const payload = data ? JSON.stringify(data) : '';

      // Get authentication headers using Layer1Digest
      const authHeaders = this.layer1Digest.buildHeaders(fullUrl, payload, method);

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders
      };

      // Make the actual HTTP request
      const config = {
        method,
        url: fullUrl,
        headers,
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_address',
          description: 'Create a new blockchain address for an asset pool',
          inputSchema: {
            type: 'object',
            properties: {
              network: {
                type: 'string',
                enum: ['ETHEREUM', 'BINANCE', 'TRON', 'RIPPLE', 'POLYGON', 'BITCOIN', 'LITECOIN', 'DOGECOIN', 'SOLANA'],
                description: 'The blockchain network',
              },
              reference: {
                type: 'string',
                description: 'Reference for the address eg: "user-id-123", "payment-id-123", etc',
              },
            },
            required: ['network', 'reference'],
          },
        },
        {
          name: 'list_transactions',
          description: 'List transactions for the asset pool',
          inputSchema: {
            type: 'object',
            properties: {
              transactionHash: {
                type: 'string',
                description: 'Filter by specific transaction hash',
              },
              transactionHash: {
                type: 'string',
                description: 'Filter by specific address reference',
              },
            },
          },
        },
        {
          name: 'get_asset_pool_balance',
          description: 'Get the balance of the asset pool',
          inputSchema: {
            type: 'object',
            properties: {
            },
          },
        },
        {
          name: 'send_transaction_request',
          description: 'Create a transaction request to send funds',
          inputSchema: {
            type: 'object',
            properties: {
              toAddress: {
                type: 'string',
                description: 'Destination address',
              },
              amount: {
                type: 'string',
                description: 'Amount to send (as string to preserve precision)',
              },
              asset: {
                type: 'string',
                enum: ['ETH', 'USDT', 'USDC', 'BTC', 'LTC', 'DOGE', 'SOL', 'BNB', 'TRX', 'XRP', 'POL'],
                description: 'Asset',
              },
              network: {
                type: 'string',
                enum: ['ETHEREUM', 'BINANCE', 'TRON', 'RIPPLE', 'POLYGON', 'BITCOIN', 'LITECOIN', 'DOGECOIN', 'SOLANA'],
                description: 'Network to send on',
              },
              reference: {
                type: 'string',
                description: 'Unique reference for the transaction',
              },
            },
            required: ['toAddress', 'amount', 'asset', 'network', 'reference'],
          },
        },
      ],
    }));
  }

  setupHandlers() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_address':
            return await this.createAddress(args);
          case 'list_transactions':
            return await this.listTransactions(args);
          case 'get_asset_pool_balance':
            return await this.getAssetPoolBalance(args);
          case 'send_transaction_request':
            return await this.sendTransactionRequest(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
      }
    });
  }

  async createAddress(args) {
    const { network, reference } = args;

    const requestData = {
      assetPoolId: this.assetPoolId,
      network,
      ...(reference && { reference }),
    };

    const result = await this.makeAuthenticatedRequest('/digital/v1/addresses', 'POST', requestData);

    return {
      content: [
        {
          type: 'text',
          text: `Address created successfully:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  async listTransactions(args) {
    const { transactionHash } = args;

    const params = {
      assetPoolId: this.assetPoolId,
    };

    if(transactionHash) {
        params.q = `hash:${transactionHash}`;
    }

    const result = await this.makeAuthenticatedRequest('/digital/v1/transactions', 'GET', null, params);

    return {
      content: [
        {
          type: 'text',
          text: `Transactions (${result.totalElements || 'unknown'} total):\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  async getAssetPoolBalance(args) {
    const { assetPoolId = this.assetPoolId } = args;

    const result = await this.makeAuthenticatedRequest(`/digital/v1/asset-pools/${assetPoolId}`);

    return {
      content: [
        {
          type: 'text',
          text: `Asset pool balance:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  async sendTransactionRequest(args) {
    const { toAddress, amount, asset, network, reference } = args;

    const requestData = {
      assetPoolId: this.assetPoolId,
      asset,
      network,
      reference,
      destinations: [
        {
            address: toAddress,
            amount
        }
      ]
    };

    const result = await this.makeAuthenticatedRequest('/digital/v1/transaction-requests', 'POST', requestData);

    return {
      content: [
        {
          type: 'text',
          text: `Transaction request created:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Layer1 Digital MCP server running on stdio');
  }
}

const server = new Layer1DigitalMCP();
server.run().catch(console.error); 