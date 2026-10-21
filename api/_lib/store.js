import { get, put, list, del } from '@vercel/blob';
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
export async function deleteOrder(id) {
  const pathname = `orders/${id}.json`;
  const { blobs } = await list({ prefix: pathname, limit: 5 });
  const b = blobs.find((x) => x.pathname === pathname);
  if (b) await del(b.url);
}
export async function listOrders(limit = 200) {
  const { blobs } = await list({ prefix: 'orders/', limit: 1000 });
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const out = [];
  for (const b of blobs.slice(0, limit)) { try { const o = await readJSON(b.pathname); if (o) out.push(o); } catch {} }
  return out;
}

/* ---- configuración editable por el administrador (db/config.json) ---- */
const CONFIG = 'db/config.json';
export const CONFIG_DEFAULTS = {
  whatsapp: '2974711779',
  notifyEmail: process.env.NOTIFY_EMAIL || '',
  botGreeting: '¡Hola! Soy el asistente de Puente Service. ¿En qué te puedo ayudar? Elegí una opción y seguimos por WhatsApp.',
  mpLink: process.env.MP_LINK || 'https://link.mercadopago.com.ar/repopuente',
};
export async function getConfig() {
  const c = await readJSON(CONFIG).catch((e) => { console.error('config read', e); return null; });
  return { ...CONFIG_DEFAULTS, ...(c || {}) };
}
export async function saveConfig(cfg) { await writeJSON(CONFIG, { ...cfg, updatedAt: new Date().toISOString() }); return cfg; }

/** Solo dígitos; saca el 0 inicial de larga distancia. */
export const cleanPhone = (v) => String(v || '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 15);
export const ORDER_ID = /^PP-[A-Z0-9-]{4,40}$/;

/* ---- usuarios (db/users.json en el Blob) ---- */
const USERS = 'db/users.json';
export const ROLES = ['admin', 'visitante'];
const hashPass = (pass, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(String(pass), salt, 64).toString('hex') });
export const publicUser = (u) => ({ user: u.user, name: u.name || '', role: u.role, phone: u.phone || '', address: u.address || '', createdAt: u.createdAt, createdBy: u.createdBy || null });
export async function getUsers() {
  const db = await readJSON(USERS).catch((e) => { console.error('users read', e); return null; });
  return db && Array.isArray(db.users) ? db.users : [];
}
export async function saveUsers(users) { await writeJSON(USERS, { users, updatedAt: new Date().toISOString() }); return users; }
export function newUser({ user, name, pass, role, phone = '', address = '' }, by) {
  return { user, name, role, phone, address, ...hashPass(pass), createdAt: new Date().toISOString(), createdBy: by || null };
}
export function setPass(u, pass) { Object.assign(u, hashPass(pass)); return u; }

/* ---- auth: HMAC-signed cookie ---- */
// Sin SESSION_SECRET se deriva del token del Blob (secreto que Vercel crea al conectar el store).
const SECRET = process.env.SESSION_SECRET || (process.env.BLOB_READ_WRITE_TOKEN ? crypto.createHash('sha256').update('pp-session:' + process.env.BLOB_READ_WRITE_TOKEN).digest('hex') : '');
const COOKIE = 'pp_session';
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export function sessionCookie(session) {
  if (!SECRET) throw Object.assign(new Error('Falta SESSION_SECRET o conectar el Blob store.'), { status: 503 });
  const exp = Date.now() + 12 * 3600e3;
  const payload = Buffer.from(JSON.stringify({ u: session.user, n: session.name || '', r: session.role, exp })).toString('base64url');
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${12 * 3600}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/** Devuelve { user, name, role } si la cookie es válida, o null. */
export function getSession(request) {
  if (!SECRET) return null;
  const raw = (request.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig || !eq(sig, sign(payload))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!(s.exp > Date.now())) return null;
    return { user: s.u, name: s.n || '', role: ROLES.includes(s.r) ? s.r : 'admin' };
  } catch { return null; }
}
export const isAdmin = (request) => getSession(request)?.role === 'admin';

/**
 * Valida usuario y contraseña. Busca primero en los usuarios del Blob;
 * la cuenta de ADMIN_USER / ADMIN_PASS (variables de entorno) queda siempre como administrador de respaldo.
 */
export async function checkLogin(user, pass) {
  const name = String(user).trim().toLowerCase();
  const u = (await getUsers()).find((x) => x.user === name);
  if (u) {
    const h = crypto.scryptSync(String(pass), u.salt, 64).toString('hex');
    return eq(h, u.hash) ? { user: u.user, name: u.name, role: u.role } : null;
  }
  const U = (process.env.ADMIN_USER || 'admin').toLowerCase(), P = process.env.ADMIN_PASS || 'Admin';
  return eq(name, U) & eq(pass, P) ? { user: U, name: 'Administrador', role: 'admin' } : null;
}

/* ---- link personal de la tarea del técnico: clave firmada por pedido (sin usuario ni contraseña) ---- */
export const taskKey = (id) => (SECRET ? sign('task:' + id).slice(0, 22) : '');
export const taskKeyOk = (id, k) => !!SECRET && !!k && eq(String(k), taskKey(id));
