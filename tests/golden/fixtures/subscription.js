export default [
  { name: 'help', argv: ['subscription', '--help'], config: null },
  { name: 'status', argv: ['subscription', 'status'] },
  { name: 'unknown-subcommand', argv: ['subscription', 'nonsense'] },
];
