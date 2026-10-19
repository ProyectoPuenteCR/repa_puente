import { json, clearCookie } from './_lib/store.js';
export function POST() { return json({ ok: true }, 200, { 'set-cookie': clearCookie() }); }
