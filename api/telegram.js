'use strict';
const crypto = require('crypto');
const { handleUpdate } = require('../lib/bot.js');
const { makeDeps } = require('../lib/deps.js');

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) { res.status(500).json({ ok: false, error: 'TELEGRAM_WEBHOOK_SECRET não configurado' }); return; }
  if (!same(req.headers['x-telegram-bot-api-secret-token'] || '', secret)) { res.status(401).end(); return; }
  try {
    await handleUpdate(req.body, makeDeps(process.env));
  } catch (e) {
    console.error('telegram', e && e.message);
  }
  res.status(200).json({ ok: true });
};
