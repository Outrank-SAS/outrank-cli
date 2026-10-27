export const MCP_HELP = `Usage:
  outrank-cli mcp [--toolsets <names|all|auto>] [--read-only] [--profile <name>] [--upload-dir <directory>]

Starts the Outrank MCP server on stdio. Every CLI command except auth login, auth logout and auth profiles is
exposed as a tool whose name is the command with underscores (products integrations list -> products_integrations_list).

Options:
  --toolsets <names>    Comma-separated toolsets to expose, or all. Default: auto (from the organization's
                        entitlements, plus the setup tools of every area).
                        Toolsets: core, integrations, gsc, linking, backlinks, keywords, articles, improvements,
                        marketplace-seller, marketplace-buyer, billing, blog, ai-cited-lists.
  --read-only           Expose only tools that do not change anything.
  --profile <name>      Use a stored profile (one per organization). See: outrank-cli auth profiles
  --upload-dir <dir>    Directory image uploads may be read from. Default: the directory the server starts in.

Environment:
  OUTRANK_API_KEY           API key, unless a profile is selected.
  OUTRANK_PROFILE           Same as --profile.
  OUTRANK_MCP_TOOLSETS      Same as --toolsets.
  OUTRANK_MCP_READ_ONLY=1   Same as --read-only.
  OUTRANK_MCP_UPLOAD_DIR    Same as --upload-dir.
  OUTRANK_MCP_DEBUG=1       Log tool calls to stderr (never headers; secrets are redacted).

Notes:
  The key is never a tool argument. A base URL outside outrank.so is accepted only when the key and the URL come
  from the same stored profile.

Examples:
  claude mcp add outrank --env OUTRANK_API_KEY=outr_live_xxx -- npx -y outrank-cli mcp
  outrank-cli mcp --profile acme --toolsets core,keywords,articles --read-only
`;

export const MCP_HELP_GUIDANCE =
  'Register this command as a stdio MCP server in the client configuration; do not run it interactively.';
