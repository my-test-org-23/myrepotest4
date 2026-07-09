import path from 'path';
import fs from 'fs';
import os from 'os';
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { attachAuth } from './auth';
import { api } from './routes/api';
import './db'; // initialize schema on startup

const app = express();

app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  })
);
app.use(express.json());
app.use(attachAuth);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', api);

// In production the built frontend is copied to ../public and served here so a
// single Node process on the VPS serves both the SPA and the API.
const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

/** First non-internal IPv4 address, so we can print a shareable LAN URL. */
function lanAddress(): string | null {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const net of iface || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

app.listen(config.port, config.host, () => {
  const lan = lanAddress();
  /* eslint-disable no-console */
  console.log(
    `Availability scheduler API listening on ${config.host}:${config.port} ` +
      `(event "${config.event.title}", ${config.event.year}-${config.event.month})`
  );
  console.log(`  Local:   http://localhost:${config.port}`);
  if (config.host === '0.0.0.0' && lan) {
    console.log(`  Network: http://${lan}:${config.port}  (reachable from other machines on your LAN)`);
  }
  /* eslint-enable no-console */
});
