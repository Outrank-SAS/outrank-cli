#!/usr/bin/env node
process.argv.splice(2, 0, 'mcp');
await import('../src/index.js');
