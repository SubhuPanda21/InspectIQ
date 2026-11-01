let memoryId = null;
export function clientId() {
  try {
    let id = localStorage.getItem('inspectiq_client');
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) { id = crypto.randomUUID(); localStorage.setItem('inspectiq_client', id); }
    return id;
  } catch {
    if (!memoryId) memoryId = crypto.randomUUID();
    return memoryId;
  }
}
async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}
export const api = (path, opts = {}) => fetch('/api' + path, { ...opts, headers: { 'content-type': 'application/json', 'x-client-id': clientId(), ...(opts.headers || {}) } }).then(parse);
export const send = (method, path, body) => api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
export const upload = (path, form) => fetch('/api' + path, { method: 'POST', headers: { 'x-client-id': clientId() }, body: form }).then(parse);
export const imageUrl = (id, kind = 'image', extra = '') => '/api/inspections/' + id + '/' + kind + '.png?cid=' + clientId() + extra;
export const fileUrl = (id, name) => '/api/inspections/' + id + '/' + name + '?cid=' + clientId();
