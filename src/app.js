import path from "node:path";
import { createRequire } from "node:module";
import express from "express";

import { createLinksRepo } from "./links.js";
import { isReserved } from "./shortcode.js";

const require = createRequire(import.meta.url);
const projectRoot = path.join(import.meta.dirname, "..");

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_URL_LENGTH = 2048;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Build the Express application.
 *
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {{ baseUrl?: string }} [options]
 */
export function createApp(db, { baseUrl = "" } = {}) {
  const links = createLinksRepo(db);
  const app = express();

  app.disable("x-powered-by");
  app.set("view engine", "pug");
  app.set("views", path.join(projectRoot, "views"));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(projectRoot, "public")));

  // Oat UI ships its minified CSS/JS in the npm package. Serve it locally
  // instead of depending on a CDN at runtime.
  const oatDir = path.dirname(require.resolve("@knadh/oat/oat.min.css"));
  app.use("/vendor/oat", express.static(oatDir, { maxAge: "1h" }));

  app.get("/favicon.ico", (req, res) => res.status(204).end());

  app.get("/status", (req, res) => {
    res.type("text/plain").send("Working...\n");
  });

  app.get("/", (req, res) => {
    const code = typeof req.query.created === "string" ? req.query.created : null;
    const created = code ? links.get(code) : null;

    renderIndex(req, res, { created });
  });

  app.post("/shorten", (req, res) => {
    const raw = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    const result = normalizeUrl(raw);

    if (result.error) {
      renderIndex(req, res, { status: 400, error: result.error, value: raw });
      return;
    }

    const link = links.getOrCreate(result.url);
    res.redirect(303, `/?created=${encodeURIComponent(link.code)}`);
  });

  app.post("/:code/delete", (req, res) => {
    links.remove(req.params.code);
    res.redirect(303, "/");
  });

  app.get("/:code", (req, res, next) => {
    const { code } = req.params;

    if (!CODE_PATTERN.test(code) || isReserved(code)) {
      next();
      return;
    }

    const link = links.registerClick(code);
    if (!link) {
      next();
      return;
    }

    res.redirect(302, link.url);
  });

  app.use((req, res) => {
    res.status(404).render("error", {
      status: 404,
      message: "Page not found.",
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (process.env.NODE_ENV !== "test") {
      console.error(error);
    }

    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).render("error", {
      status: 500,
      message: "Something went wrong. Please try again.",
    });
  });

  const resolveOrigin = (req) => {
    if (baseUrl) return baseUrl.replace(/\/+$/, "");
    const host = req.get("host");
    return host ? `${req.protocol}://${host}` : "http://localhost";
  };

  const toView = (link, origin) => ({
    ...link,
    shortUrl: `${origin}/${link.code}`,
    createdLabel: formatDate(link.created_at),
  });

  const renderIndex = (
    req,
    res,
    { status = 200, error = null, created = null, value = "" } = {},
  ) => {
    const origin = resolveOrigin(req);

    res.status(status).render("index", {
      links: links.list().map((link) => toView(link, origin)),
      created: created ? toView(created, origin) : null,
      error,
      value,
    });
  };

  return app;
}

/**
 * Validate and normalize a user-supplied URL.
 *
 * @param {string} input
 * @returns {{ url: string } | { error: string }}
 */
function normalizeUrl(input) {
  if (!input) {
    return { error: "Enter a URL to shorten." };
  }

  if (input.length > MAX_URL_LENGTH) {
    return { error: `That URL is too long (${MAX_URL_LENGTH} characters max).` };
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return { error: "That does not look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "Only http:// and https:// URLs can be shortened." };
  }

  if (!parsed.hostname) {
    return { error: "That URL is missing a hostname." };
  }

  return { url: parsed.href };
}

/**
 * @param {string} value SQLite CURRENT_TIMESTAMP (UTC, "YYYY-MM-DD HH:MM:SS").
 * @returns {string}
 */
function formatDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}
