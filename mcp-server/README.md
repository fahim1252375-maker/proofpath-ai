# ProofPath AI MCP Server

A standalone, read-only [Model Context Protocol](https://modelcontextprotocol.io/) server for ProofPath AI.

## Inventory

- **Servers built:** 1 — `proofpath-ai-mcp-server`
- **MCP tools:** 5
- **Transport:** stdio
- **MCP client used for verification:** official MCP TypeScript SDK client in the automated integration test
- **HTTP API routes consumed:** 5 existing public GET routes
- **Cross-project reuse:** none yet
- **Write operations:** none

## Tools

| Tool | Existing API route | Behaviour |
|---|---|---|
| `search_opportunities` | `GET /api/opportunities` | Search and filter published opportunities |
| `get_opportunity_details` | `GET /api/opportunities/:id` | Read an allowlisted public opportunity projection and verification-history count |
| `compare_opportunities` | `GET /api/opportunities/compare` | Compare one to four published opportunities |
| `get_public_platform_stats` | `GET /api/public/stats` | Read aggregate platform counts |
| `check_api_health` | `GET /api/health` | Read API/database health without configuration flags |

All tools are annotated as read-only. The server does not use a database connection, bypass application authorization, access student profiles, or return the raw verification history returned by the legacy detail route. No create, update, delete, moderation, or AI-verification action is exposed.

## Requirements and setup

- Node.js 22+
- Access to a running ProofPath AI HTTP API

From this directory:

```bash
npm install
npm test
npm start
```

The default API base URL is `https://proofpath-ai-demo.onrender.com`. Override it for local development:

```bash
PROOFPATH_API_BASE_URL=http://127.0.0.1:3000 npm start
```

The URL must be HTTPS, except for local loopback addresses, which may use HTTP. The MCP server sends only GET requests and applies a 10-second timeout and a bounded response size.

## MCP host configuration

The repository-root `.mcp.json` provides a stdio configuration for compatible project-scoped hosts. Install this package's dependencies before starting the host. The configured API base URL may be changed to a local development server.

## Tests

`npm test` runs a real stdio subprocess, connects with the official MCP SDK `Client`, verifies initialization and tool discovery, invokes all five tools against a local mock ProofPath HTTP API, checks that the upstream HTTP method is GET only, and confirms private verification-report fields and configuration flags are not exposed.

## Current transport scope

Only stdio is implemented and tested. Streamable HTTP, legacy SSE, and WebSocket are not implemented or claimed. The MCP server is currently specific to ProofPath AI; cross-project reuse is future work, not an existing capability.
