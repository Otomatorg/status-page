import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { WorkflowMonitor } from './monitor.js';
import { runVerifications } from './runVerifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

const monitor = new WorkflowMonitor();

// Serve static files from docs directory
app.use(express.static('docs'));

app.get('/', (req, res) => {
  res.sendFile('docs/index.html', { root: __dirname });
});

// --- Scheduler Integration ---
// Helper to run shell commands and log output
function runCommand(command: string) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`[${new Date().toISOString()}] Error:`, error);
      return;
    }
    if (stdout) console.log(`[${new Date().toISOString()}] ${stdout}`);
    if (stderr) console.error(`[${new Date().toISOString()}] ${stderr}`);
  });
}

// --- Clear Old Logs Job (daily at 2 AM) ---
function clearOldLogsJob() {
  const executionsDir = path.resolve('docs/executions');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 21);

  if (!fs.existsSync(executionsDir)) return;

  fs.readdirSync(executionsDir).forEach((dir) => {
    // Only match YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dir)) return;
    const dirDate = new Date(dir);
    if (isNaN(dirDate.getTime())) return;
    if (dirDate < cutoff) {
      const fullPath = path.join(executionsDir, dir);
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`[${new Date().toISOString()}] Removed old execution logs: ${fullPath}`);
    }
  });
}

// --- Scheduling ---
function schedule(fn: () => void, intervalMs: number, runAtStart = false) {
  if (runAtStart) fn();
  setInterval(fn, intervalMs);
}

// Run monitoring job every 10 minutes
schedule(async () => {
  console.log(`[${new Date().toISOString()}] Running monitoring job...`);
  await monitor.runMonitoring().catch(console.error);
  runVerifications();
}, 10 * 60 * 1000, true);

// Run clear logs job daily at 2 AM
function scheduleDailyAt(hour: number, minute: number, fn: () => void) {
  function getNextTimeout() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }
  setTimeout(function tick() {
    fn();
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }, getNextTimeout());
}

scheduleDailyAt(2, 0, clearOldLogsJob);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Scheduler started:`);
  console.log(`  - Monitoring job: every 10 minutes`);
  console.log(`  - Log cleanup: daily at 2 AM`);
});
