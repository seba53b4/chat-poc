export async function health(req, res) {
  res.json({ ok: true, uptime: process.uptime() });
}
