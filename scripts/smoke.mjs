import assert from 'node:assert/strict'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080'

// Startup can include waking a sleeping Neon database.
let ready = false
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(2_000) })
    if (response.ok) {
      ready = true
      break
    }
  } catch {
    // Retry while the app starts.
  }
  await new Promise(resolve => setTimeout(resolve, 1_000))
}
assert.ok(ready, 'The app did not start within 30 seconds')

const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(20_000) })
assert.equal(health.status, 200, 'The API could not reach PostgreSQL')
assert.deepEqual(await health.json(), { status: 'ok', database: 'connected' })
console.log('PASS: HTTP API → Go → PostgreSQL')

const page = await fetch(base)
assert.equal(page.status, 200)
const html = await page.text()
assert.match(html, /<title>Koya Clinic<\/title>/)
const script = html.match(/<script[^>]+src="([^"]+)"/)
assert.ok(script, 'The frontend entry script is missing')
const asset = await fetch(new URL(script[1], base))
assert.equal(asset.status, 200, 'The frontend script could not load')
console.log('PASS: frontend page and JavaScript served')

const missing = await fetch(`${base}/api/missing`)
assert.equal(missing.status, 404)
assert.match(missing.headers.get('content-type'), /application\/json/)
console.log('PASS: unknown API endpoints return JSON 404')

for (const path of ['/.env', '/.env.local', '/backend/main.go']) {
  const response = await fetch(`${base}${path}`)
  if (response.status === 200) {
    // Vite can return its public page for unknown paths. It must never return a private file.
    assert.equal(await response.text(), html, `${path} exposed a private file`)
  } else {
    assert.ok([403, 404].includes(response.status), `${path} must not be accessible`)
  }
}
console.log('PASS: credentials and backend source are not public')
