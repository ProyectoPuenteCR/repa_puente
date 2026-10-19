import { get, put, list } from '@vercel/blob';
import crypto from 'node:crypto';
import seed from '../../data/seed.js';

const CATALOG = 'db/catalog.json';
const OPTS = { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 };

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

async function readJSON(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return await new Response(r.stream).json();
}
async function writeJSON(pathname, data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw Object.assign(new Error('Falta conectar el almacenamiento Blob al proyecto en Vercel.'), { status: 503 });
  return put(pathname, JSON.stringify(data), OPTS);
}
export const fail = (e) => json({ error: e.message || 'Error del servidor' }, e.status || 500);

export async function getCatalog() {
  try { const db = await readJSON(CATALOG); if (db && Array.isArray(db.items)) return db; } catch (e) { console.error('catalog read', e); }
  return structuredClone(seed);
}
export async function saveCatalog(db) { db.updatedAt = new Date().toISOString(); await writeJSON(CATALOG, db); return db; }
export const seedCatalog = () => structuredClone(seed);

export async function saveOrder(order) { await writeJSON(`orders/${order.id}.json`, order); return order; }
export async function getOrder(id) { return readJSON(`orders/${id}.json`); }
export async function listOrders(limit = 60) {
  const { blobs } = await list({ prefix: 'orders/', limit: 1000 });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const out = [];
  for (const b of blobs.slice(0, limit)) { try { const o = await readJSON(b.pathname); if (o) out.push(o); } catch {} }
  return out;
}

/* ---- auth: HMAC-signed cookie ---- */
// Sin SESSION_SECRET se deriva del token del Blob (secreto que Vercel crea al conectar el store).
const SECRET = process.env.SESSION_SECRET || (process.env.BLOB_READ_WRITE_TOKEN ? crypto.createHash('sha256').update('pp-session:' + process.env.BLOB_READ_WRITE_TOKEN).digest('hex') : '');
const COOKIE = 'pp_session';
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
export function sessionCookie(user) {
  if (!SECRET) throw Object.assign(new Error('Falta SESSION_SECRET o conectar el Blob store.'), { status: 503 });
  const exp = Date.now() + 12 * 3600e3;
  const payload = Buffer.from(JSON.stringify({ u: user, exp })).toString('base64url');
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${12 * 3600}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
export function isAdmin(request) {
  if (!SECRET) return false;
  const raw = (request.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return false;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
export function checkLogin(user, pass) {
  const U = process.env.ADMIN_USER || 'admin', P = process.env.ADMIN_PASS || 'Admin';
  const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  return eq(String(user).toLowerCase(), U.toLowerCase()) & eq(pass, P);
}
