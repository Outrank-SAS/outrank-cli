export default [
  { name: 'no-args-shows-help', argv: [], config: null },
  { name: 'help-flag', argv: ['--help'], config: null },
  { name: 'version-flag', argv: ['--version'], config: null },
  { name: 'unknown-group', argv: ['nonsense'], config: null },
  { name: 'mcp-help', argv: ['mcp', '--help'], config: null },
  { name: 'mcp-help-after-options', argv: ['mcp', '--toolsets', 'all', '--help'], config: null },
];
