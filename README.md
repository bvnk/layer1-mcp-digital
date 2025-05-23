# Layer1 Digital Asset MCP Server

A Model Context Protocol (MCP) server for the Layer1 Digital Asset API, enabling AI assistants to interact with blockchain digital asset operations using RFC 9421 HTTP Message Signatures for authentication.

## Features

This MCP server provides the following capabilities:

- **Create Address**: Generate new blockchain addresses for asset pools
- **List Transactions**: Query and filter transactions by hash
- **Check Asset Pool Balance**: Get real-time balance information
- **Send Transaction Request**: Create transaction requests to send funds

## Prerequisites

- Node.js 18+ 
- Layer1 Digital Asset API credentials (clientId, privateKey, assetPoolId)

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables by copying `env.example` to `.env`:
   ```bash
   cp env.example .env
   ```

4. Update the `.env` file with your Layer1 credentials:
   ```env
   LAYER1_ASSET_POOL_ID=your-asset-pool-id
   LAYER1_CLIENT_ID=your-client-id
   LAYER1_PRIVATE_KEY="your-private-key"
   ```

## Usage

### Running the MCP Server

Start the server in development mode:
```bash
npm run dev
```

Or run in production:
```bash
npm start
```

### Available Tools

#### 1. Create Address
Creates a new blockchain address for an asset pool.

**Parameters:**
- `network` (required): Blockchain network (ETHEREUM, BINANCE, TRON, RIPPLE, POLYGON, BITCOIN, LITECOIN, DOGECOIN, SOLANA)
- `reference` (required): Reference for the address (e.g., "user-id-123", "payment-id-123")

**Example:**
```json
{
  "network": "ETHEREUM",
  "reference": "user-id-123"
}
```

#### 2. List Transactions
Lists transactions for the asset pool with optional filtering.

**Parameters:**
- `transactionHash` (optional): Filter by specific transaction hash

**Example:**
```json
{
  "transactionHash": "0x1234567890abcdef..."
}
```

#### 3. Get Asset Pool Balance
Retrieves the current balance of the asset pool.

**Parameters:**
- No required parameters (uses default asset pool ID from configuration)

**Example:**
```json
{}
```

#### 4. Send Transaction Request
Creates a transaction request to send funds.

**Parameters:**
- `toAddress` (required): Destination address
- `amount` (required): Amount to send (as string for precision)
- `asset` (required): Asset symbol (ETH, USDT, USDC, BTC, LTC, DOGE, SOL, BNB, TRX, XRP, POL)
- `network` (required): Network to send on (ETHEREUM, BINANCE, TRON, RIPPLE, POLYGON, BITCOIN, LITECOIN, DOGECOIN, SOLANA)
- `reference` (required): Reference for the transaction

**Example:**
```json
{
  "toAddress": "0x742d35Cc6635C0532925a3b8D400d8DD2Dc4A4f7",
  "amount": "0.001",
  "asset": "ETH",
  "network": "ETHEREUM",
  "reference": "Payment for services"
}
```

## Authentication

The server uses RFC 9421 HTTP Message Signatures for authentication, which provides stronger security than traditional API keys or Bearer tokens. The authentication process:

1. **Signature Base Creation**: Creates a canonical representation of the HTTP request components
2. **Cryptographic Signing**: Signs the signature base using RSA with SHA-256
3. **Header Addition**: Adds `Signature-Input` and `Signature` headers to the request

### RFC 9421 Implementation Details

- **Algorithm**: RSA with SHA-256 (`rsa-v1_5-sha256`)
- **Key Type**: RSA private key in PKCS#8 PEM format
- **Signed Components**: 
  - `@method` - HTTP method
  - `@target-uri` - Full request URL
  - `content-digest` - SHA-256 hash of request body (for POST/PUT requests)

This approach ensures message integrity and authenticity, making it impossible for attackers to modify requests without invalidating the signature.

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `LAYER1_ASSET_POOL_ID` | Asset pool identifier | Yes | None |
| `LAYER1_CLIENT_ID` | Client identifier used as keyid | Yes | None |
| `LAYER1_PRIVATE_KEY` | RSA private key for HTTP signature signing | Yes | None |

### API Base URL

The server is configured to use `https://api.sandbox.layer1.com` as the base URL for all API requests.

## Error Handling

The server provides comprehensive error handling:

- **Signature Errors**: RSA signing and HTTP signature generation issues
- **API Errors**: HTTP status codes and response body details
- **Network Errors**: Connection and timeout issues
- **Validation Errors**: Missing or invalid parameters

All errors are returned with descriptive messages to help with debugging.

## Development

### Project Structure

```
├── index.js           # Main MCP server implementation with RFC 9421 auth
├── package.json       # Node.js dependencies and scripts
├── env.example        # Environment variables template
└── README.md          # This documentation
```

### Testing

To test the MCP server, you can use any MCP-compatible client or run the server directly:

```bash
node index.js
```

The server will log to stderr when it's running and ready to accept MCP requests.

## API Reference

This MCP server integrates with the Layer1 Digital Asset API using RFC 9421 HTTP Message Signatures. For complete API documentation, refer to:

- [Layer1 JavaScript SDK](https://github.com/bvnk/layer1-sdk-javascript-digital)
- [RFC 9421: HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421.html)
- Layer1 Digital Asset API Documentation

## Security Notes

- **Private Key Security**: Never commit your actual private keys to version control
- **Environment Variables**: Store sensitive credentials in environment variables
- **Key Management**: Use secure key management in production environments
- **Key Rotation**: Regularly rotate API credentials
- **Signature Verification**: The HTTP Message Signatures provide cryptographic proof of request integrity

## Libraries Used

- `@modelcontextprotocol/sdk` - MCP server framework
- `axios` - HTTP client
- `crypto` - Node.js cryptographic functions for RSA signing
- `dotenv` - Environment variable management

## License

MIT License

## Support

For issues related to:
- **MCP Server**: Create an issue in this repository
- **Layer1 API**: Contact Layer1 support
- **RFC 9421**: Refer to the RFC 9421 specification
- **MCP Protocol**: Refer to the MCP documentation 