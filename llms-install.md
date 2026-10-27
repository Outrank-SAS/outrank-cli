# Installing the Outrank MCP server

Outrank is an SEO content platform. Its MCP server plans keywords, generates and publishes articles, rewrites declining pages, runs AI-Cited Lists outreach for Backlinks Enterprise products, and reads Search Console, backlink and internal-linking data for the user's Outrank organization.

## Option 1: hosted server (recommended)

Add a remote MCP server with this URL and no other settings:

```
https://www.outrank.so/api/mcp
```

Transport: Streamable HTTP. Authentication: OAuth 2.1 with dynamic client registration; the client opens a browser where the user signs in to Outrank and clicks Allow. Only organization admins can connect.

Example configuration for clients that use an `mcpServers` map:

```json
{
  "mcpServers": {
    "outrank": { "url": "https://www.outrank.so/api/mcp" }
  }
}
```

A client that cannot do OAuth can send an API key instead, as a header: `Authorization: Bearer outr_live_...`. The user creates the key at https://www.outrank.so/api-keys. Never ask the user to paste the key into the chat.

## Option 2: local server

Requires Node.js 18 or newer and an API key in `OUTRANK_API_KEY`:

```json
{
  "mcpServers": {
    "outrank": {
      "command": "npx",
      "args": ["-y", "outrank-cli@latest", "mcp"],
      "env": { "OUTRANK_API_KEY": "outr_live_..." }
    }
  }
}
```

Ask the user to fill in the key themselves in the configuration file.

## Check

Call the `auth_whoami` tool. It returns the organization, the toolsets that are on and what to do next.

Docs: https://www.outrank.so/docs/mcp
