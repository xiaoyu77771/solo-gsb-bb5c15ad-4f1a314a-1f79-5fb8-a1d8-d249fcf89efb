'use strict';

const path = require('path');
const express = require('express');
const { impose } = require('./lib/imposition');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/impose', (req, res) => {
  try {
    const plan = impose({
      pages: Number(req.query.pages),
      sheetsPerSignature: Number(req.query.sheets),
      binding: req.query.binding,
      flip: req.query.flip,
    });
    res.json(plan);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.post('/api/impose', (req, res) => {
  try {
    const plan = impose({
      pages: Number(req.body.pages),
      sheetsPerSignature: Number(req.body.sheetsPerSignature),
      binding: req.body.binding,
      flip: req.body.flip,
    });
    res.json(plan);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`骑马钉拼版预演服务已启动: http://localhost:${PORT}`);
});
