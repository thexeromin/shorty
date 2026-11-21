process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";

async function startServer(t) {
  const db = openDb(":memory:");
  const app = createApp(db);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });

  const { port } = server.address();
  return { db, origin: `http://127.0.0.1:${port}` };
}

function shorten(origin, url) {
  return fetch(`${origin}/shorten`, {
    method: "POST",
    body: new URLSearchParams({ url }),
    redirect: "manual",
  });
}

function createdCode(response, origin) {
  const location = response.headers.get("location");
  assert.ok(location, "expected a redirect location");
  return new URL(location, origin).searchParams.get("created");
}

test("shortens a URL and lists it", async (t) => {
  const { origin } = await startServer(t);

  const response = await shorten(origin, "https://example.com/a/long/path?x=1");
  assert.equal(response.status, 303);

  const code = createdCode(response, origin);
  assert.match(code, /^[A-Za-z0-9_-]{7}$/);

  const html = await (await fetch(origin)).text();
  assert.ok(html.includes(`/${code}`));
  assert.ok(html.includes("https://example.com/a/long/path?x=1"));
});

test("redirects to the original URL and counts clicks", async (t) => {
  const { db, origin } = await startServer(t);
  const code = createdCode(await shorten(origin, "https://example.com/click"), origin);

  const first = await fetch(`${origin}/${code}`, { redirect: "manual" });
  assert.equal(first.status, 302);
  assert.equal(first.headers.get("location"), "https://example.com/click");

  await fetch(`${origin}/${code}`, { redirect: "manual" });
  await fetch(`${origin}/${code}`, { redirect: "manual" });

  const row = db.prepare("SELECT clicks FROM links WHERE code = ?").get(code);
  assert.equal(row.clicks, 3);
});

test("rejects invalid URLs", async (t) => {
  const { origin } = await startServer(t);

  for (const value of ["", "not a url", "javascript:alert(1)", "ftp://example.com/file"]) {
    const response = await shorten(origin, value);
    assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(value)}`);

    const html = await response.text();
    assert.ok(html.includes('role="alert"'));
  }
});

test("returns the existing code for a duplicate URL", async (t) => {
  const { origin } = await startServer(t);

  const first = createdCode(await shorten(origin, "https://example.com/dup"), origin);
  const second = createdCode(await shorten(origin, "https://example.com/dup"), origin);

  assert.equal(first, second);
});

test("deletes a link", async (t) => {
  const { origin } = await startServer(t);
  const code = createdCode(await shorten(origin, "https://example.com/delete-me"), origin);

  const response = await fetch(`${origin}/${code}/delete`, {
    method: "POST",
    redirect: "manual",
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");

  const gone = await fetch(`${origin}/${code}`, { redirect: "manual" });
  assert.equal(gone.status, 404);
});

test("returns 404 for an unknown code", async (t) => {
  const { origin } = await startServer(t);

  const response = await fetch(`${origin}/doesnotexist`, { redirect: "manual" });
  assert.equal(response.status, 404);
});
