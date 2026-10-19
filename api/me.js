import { json, isAdmin } from './_lib/store.js';
export function GET(request) { return json({ admin: isAdmin(request), mp: !!process.env.MP_ACCESS_TOKEN }); }
