#!/usr/bin/env node

/**
 * Display configured services with their ports
 * Usage: node scripts/pm2-ports.js
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Service configurations
const services = [
  { name: 'api-gateway', folder: 'api-gateway' },
  { name: 'auth-service', folder: 'auth-service' },
  { name: 'visits-service', folder: 'visits-service' },
  { name: 'fhir-api-backend', folder: 'fhir-api-backend' },
  { name: 'analytics-service', folder: 'analytics-service' },
  { name: 'fitbit-service', folder: 'fitbit-service' },
  { name: 's3-bucket-service', folder: 's3-bukcet-service' },
  { name: 'oura-service', folder: 'oura-service' },
  { name: 'notification-service', folder: 'notification-service' }
];

function readPortFromEnv(folderName) {
  // Try multiple paths:
  // 1. ./folderName/.env.production (EC2 where script is in /home/ubuntu)
  // 2. ./folderName/.env (EC2)
  // 3. ../folderName/.env.production (local in scripts/ folder)
  // 4. ../folderName/.env (local)
  const envPaths = [
    path.join(__dirname, folderName, '.env.production'),
    path.join(__dirname, folderName, '.env'),
    path.join(__dirname, '..', folderName, '.env.production'),
    path.join(__dirname, '..', folderName, '.env')
  ];
  
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const portMatch = envContent.match(/^PORT=(\d+)/m);
      if (portMatch) {
        return portMatch[1];
      }
    }
  }
  return 'N/A';
}

function getPM2Status() {
  try {
    const output = execSync('pm2 jlist', { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (error) {
    return [];
  }
}

function formatMemory(bytes) {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + 'K';
  return Math.round(bytes / (1024 * 1024)) + 'M';
}

// Get PM2 status
const pm2List = getPM2Status();
const pm2Map = {};
pm2List.forEach(proc => {
  pm2Map[proc.name] = proc;
});

console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
console.log('║                    Services Configuration & Status                     ║');
console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

// Table header
console.log('┌─────────────────────────┬────────┬──────────┬──────┬─────────┬─────────┐');
console.log('│ Service                 │ Status │ Restarts │ Port │ CPU     │ Memory  │');
console.log('├─────────────────────────┼────────┼──────────┼──────┼─────────┼─────────┤');

services.forEach(service => {
  const name = service.name.padEnd(23);
  const port = String(readPortFromEnv(service.folder)).padStart(4);
  
  const pm2Proc = pm2Map[service.name];
  
  let status = '⚪ N/A';
  let restarts = 'N/A'.padStart(8);
  let cpu = 'N/A'.padStart(7);
  let memory = 'N/A'.padStart(7);
  
  if (pm2Proc) {
    status = pm2Proc.pm2_env.status === 'online' ? '🟢 ON ' : '🔴 OFF';
    restarts = String(pm2Proc.pm2_env.restart_time || 0).padStart(8);
    cpu = pm2Proc.monit ? `${pm2Proc.monit.cpu}%`.padStart(7) : 'N/A'.padStart(7);
    memory = pm2Proc.monit ? formatMemory(pm2Proc.monit.memory).padStart(7) : 'N/A'.padStart(7);
  }
  
  console.log(`│ ${name} │ ${status} │ ${restarts} │ ${port} │ ${cpu} │ ${memory} │`);
});

console.log('└─────────────────────────┴────────┴──────────┴──────┴─────────┴─────────┘\n');

if (pm2List.length === 0) {
  console.log('⚠️  No PM2 processes running. Start services with: pm2 start ecosystem.config.js\n');
} else {
  console.log(`✓ ${pm2List.length} service(s) running in PM2\n`);
}
