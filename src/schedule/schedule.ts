import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

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

// --- Monitoring Job (every 10 minutes) ---
function runMonitoringJob() {
  // Equivalent to: npm run build:verify
  runCommand('npm run build:verify');
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
schedule(runMonitoringJob, 10 * 60 * 1000, false);

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
