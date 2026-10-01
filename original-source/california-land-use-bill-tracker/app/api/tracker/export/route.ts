import { env } from 'cloudflare:workers';

export const runtime = 'edge';
const prefix = 'export_';
const lifetime = 15 * 60 * 1000;
function database(){ if (!env.DB) throw new Error('Tracker storage is unavailable'); return env.DB; }

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const isForm = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
  const referrer = request.headers.get('referer');
  let sameOriginReferrer = false;
  try { sameOriginReferrer = !!referrer && new URL(referrer).origin === origin; } catch { /* Invalid referrer. */ }
  if (request.headers.get('origin') !== origin && !sameOriginReferrer) return Response.json({ error: 'Open Export from the tracker.' }, { status: 403 });
  const csv = isForm ? (await request.formData().catch(() => null))?.get('csv') : (await request.json().catch(() => null) as {csv?:unknown}|null)?.csv;
  if (typeof csv !== 'string' || csv.length > 2_000_000 || !csv.startsWith('\uFEFF"List","Legislative session","Bill"')) {
    return Response.json({ error: 'The CSV could not be prepared.' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await database().prepare('INSERT INTO scan_state (id,checked_at,result) VALUES (?,?,?)').bind(prefix + id, new Date().toISOString(), csv).run();
  const url = `/api/tracker/export?file=${encodeURIComponent(id)}`;
  if (isForm) return new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CSV ready</title><body style="font:18px system-ui;margin:32px;color:#002d73"><h1>CSV ready</h1><p>Open the file in your browser to save it:</p><p><a href="${url}" target="_blank" rel="noopener">Download tracker CSV</a></p><p><a href="/tracker">Return to tracker</a></p></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  return Response.json({ url }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('file');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return new Response('Export unavailable.', { status: 404 });
  const row = await database().prepare('SELECT checked_at,result FROM scan_state WHERE id=?').bind(prefix + id).first<{checked_at:string;result:string}>();
  if (!row || Date.now() - Date.parse(row.checked_at) > lifetime) return new Response('Export expired. Return to the tracker and select Export again.', { status: 404 });
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return new Response(row.result, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="california-land-use-bills-visible-${values.year}-${values.month}-${values.day}.csv"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff'
  } });
}
