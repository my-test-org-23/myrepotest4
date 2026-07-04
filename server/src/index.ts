import path from 'path';
import fs from 'fs';
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

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `Availability scheduler API listening on :${config.port} ` +
      `(event "${config.event.title}", ${config.event.year}-${config.event.month})`
  );
});
