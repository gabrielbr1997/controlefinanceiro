'use strict';
const crypto = require('crypto');
const { sendReminders } = require('../lib/bot.js');
const { makeDeps } = require('../lib/deps.js');

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/* Chamado todo dia pela Vercel (veja "crons" no vercel.json). A Vercel envia CRON_SECRET no cabeçalho Authorization. */
module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) { res.status(500).json({ ok: false, error: 'CRON_SECRET não configurado' }); return; }
  if (!same(req.headers.authorization || '', 'Bearer ' + secret)) { res.status(401).end(); return; }
  try {
    const sent = await sendReminders(makeDeps(process.env));
    res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error('reminders', e && e.message);
    res.status(500).json({ ok: false });
  }
};
