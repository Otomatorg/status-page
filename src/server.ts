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
  res.sendFile('docs/data/index.html', { root: __dirname });
});

app.get('/api/download', async (req: any, res: any) => {
  try {
    // Query params: date (YYYY-MM-DD), type (comparisonData, executionData, errorLog)
    const { date, type } = req.query;

    // Validate type
    const allowedTypes = ['comparisonData', 'executions', 'errorLog'];
    let fileType = typeof type === 'string' ? type : undefined;
    if (fileType && !allowedTypes.includes(fileType)) {
      return res.status(400).json({ error: 'Invalid type. Allowed: comparisonData, executions, errorLog' });
    }

    // Validate date
    let dateStr = typeof date === 'string' ? date : undefined;
    if (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Build file path(s)
    const baseDir = path.resolve('docs/data/executions');
    let filesToSend: { filePath: string, downloadName: string }[] = [];

    if (dateStr) {
      // Specific date
      const dirPath = path.join(baseDir, dateStr);
      if (!fs.existsSync(dirPath)) {
        return res.status(404).json({ error: 'No data for specified date' });
      }
      if (fileType) {
        // Specific file type
        const filePath = path.join(dirPath, `${fileType}.json`);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: `File not found: ${fileType}.json for ${dateStr}` });
        }
        filesToSend.push({ filePath, downloadName: `${dateStr}_${fileType}.json` });
      } else {
        // All types for the date
        for (const t of allowedTypes) {
          const filePath = path.join(dirPath, `${t}.json`);
          if (fs.existsSync(filePath)) {
            filesToSend.push({ filePath, downloadName: `${dateStr}_${t}.json` });
          }
        }
        if (filesToSend.length === 0) {
          return res.status(404).json({ error: `No data files found for ${dateStr}` });
        }
      }
    } else {
      // No date: get all available files of the type (or all types)
      const dateDirs = fs.readdirSync(baseDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
      for (const d of dateDirs) {
        const dirPath = path.join(baseDir, d);
        if (fileType) {
          const filePath = path.join(dirPath, `${fileType}.json`);
          if (fs.existsSync(filePath)) {
            filesToSend.push({ filePath, downloadName: `${d}_${fileType}.json` });
          }
        } else {
          for (const t of allowedTypes) {
            const filePath = path.join(dirPath, `${t}.json`);
            if (fs.existsSync(filePath)) {
              filesToSend.push({ filePath, downloadName: `${d}_${t}.json` });
            }
          }
        }
      }
      if (filesToSend.length === 0) {
        return res.status(404).json({ error: 'No data files found' });
      }
    }

    if (filesToSend.length === 1) {
      // Send single file as download
      const { filePath, downloadName } = filesToSend[0];
      res.download(filePath, downloadName);
    } else {
      // Multiple files: zip and send
      // Use archiver for zipping (assume not imported at top, so require here)
      const archiver = (await import('archiver')).default;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="data_files.zip"');
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      for (const { filePath, downloadName } of filesToSend) {
        archive.file(filePath, { name: downloadName });
      }
      archive.finalize();
    }
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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
  const executionsDir = path.resolve('docs/data/executions');
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
