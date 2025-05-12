/**
 * Simple script to start the backend server for the AI-Scrum application
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting AI-Scrum backend server...');

// Check if we should use the compiled TypeScript or run directly with ts-node
const useCompiledTs = process.argv.includes('--compiled');

// Command to run
let command;
let args;

if (useCompiledTs) {
  console.log('Using compiled TypeScript...');
  command = 'node';
  args = ['dist/index.js'];
} else {
  console.log('Using ts-node for development...');
  command = 'npx';
  args = ['ts-node', 'src/index.ts'];
}

// Spawn the server process
const server = spawn(command, args, {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// Handle process events
server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

console.log('Server starting... Press Ctrl+C to stop'); 