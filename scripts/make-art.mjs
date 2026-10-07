/**
 * Draws the artwork for the profile README.
 *
 *   node scripts/make-art.mjs
 *
 * No dependencies, on purpose. A profile README outlives the enthusiasm that
 * built it, and artwork that needs `npm install` to change is artwork that
 * never gets changed. This runs on a stock Node and writes plain SVG.
 *
 * Everything comes in a light and a dark pair, because the README picks between
 * them with `<picture>` and `prefers-color-scheme`, so the page follows
 * whatever the reader's GitHub is set to.
 *
 * The one rule worth keeping: the *shapes* are hand-drawn, the *text* is not.
 * A wobbly frame around clean type is the look drawably uses in OpenPuzzle —
 * crisp inside the sketch — and a squiggly font would just be harder to read.
 *
 * The only block worth editing is `CONTENT`, immediately below.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "assets");

/* ------------------------------------------------------------------ */
/* EDIT THIS BIT                                                       */
/*                                                                     */
/* Everything below these lines is drawing code. These are the only     */
/* values worth touching, and after changing any of them run:           */
/*                                                                     */
/*     node scripts/make-art.mjs                                        */
/*                                                                     */
/* then commit the regenerated SVGs. GitHub serves the README straight  */
/* from the repository with no build step, so the artwork has to be     */
/* committed; it cannot be generated on the way out.                    */
/* ------------------------------------------------------------------ */

const CONTENT = {
  /** Goes in the hero banner and nowhere else. */
  name: "DeadLaurin",

  /** The line under your name. The one thing people actually remember. */
  tagline: "Small tools, built properly.",

  /**
   * One card per project, in the order they should appear. OpenPuzzle slots in
   * here as a second entry the moment its repository is public — a private one
   * would give visitors a 404.
   */
  cards: [
    {
      title: "primitive-desktop",
      blurb: "Rebuilds a photo out of circles, triangles and rectangles.",
      meta: "Go  ·  native macOS  ·  no dependencies",
      badge: "building",
    },
  ],

  /** Rows of chips. Each row is drawn on one canvas so two rows match. */
  chipRows: {
    languages: ["TypeScript", "Go", "Java", "Python", "JavaScript", "Shell", "PHP", "HTML + CSS"],
    platforms: ["Cloudflare", "Docker", "Linux", "macOS", "GitHub Actions", "Vercel", "Netlify"],
  },
};

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

const LIGHT = {
  name: "light",
  paper: "#fbf7ef",
  card: "#f5eee0",
  ink: "#2b2622",
  soft: "#6e675f",
  faint: "rgba(43,38,34,0.20)",
  accent: "#c0392b",
};

const DARK = {
  name: "dark",
  paper: "#17161b",
  card: "#201f26",
  ink: "#eae3d6",
  soft: "#9d9488",
  faint: "rgba(234,227,214,0.24)",
  accent: "#ff8a7a",
};

/* ------------------------------------------------------------------ */
/* A small random number generator, so every run draws the same picture */
/* ------------------------------------------------------------------ */

function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const round = (n) => Math.round(n * 100) / 100;

/** Points around a rounded rectangle, spaced out enough to look drawn. */
function roundedRectPoints(x, y, w, h, r, step = 7) {
  const points = [];
  const corner = (cx, cy, from, to) => {
    const span = to - from;
    const n = Math.max(2, Math.ceil((Math.abs(span) * r) / step));
    for (let i = 0; i <= n; i++) {
      const a = from + (span * i) / n;
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  const PI = Math.PI;
  corner(x + w - r, y + r, -PI / 2, 0);
  corner(x + w - r, y + h - r, 0, PI / 2);
  corner(x + r, y + h - r, PI / 2, PI);
  corner(x + r, y + r, PI, PI * 1.5);
  points.pop(); // the loop closes itself
  return points;
}

function jitter(points, rand, amp) {
  return points.map(([x, y]) => [x + (rand() - 0.5) * 2 * amp, y + (rand() - 0.5) * 2 * amp]);
}

/** A smooth curve through every point, closed. What a pen does at speed. */
function smoothClosed(points) {
  const n = points.length;
  const at = (i) => points[((i % n) + n) % n];
  let d = `M${round(at(0)[0])} ${round(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    // Catmull-Rom, converted to the cubic Bezier an SVG wants.
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return `${d}Z`;
}

/** An open smooth curve. */
function smoothOpen(points) {
  const n = points.length;
  const at = (i) => points[Math.max(0, Math.min(n - 1, i))];
  let d = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return d;
}

const FONT = "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Two passes over one line, the way a pen goes back over a stroke. */
function doubledLine(x1, y1, x2, y2, rand, amp) {
  const out = [];
  for (let pass = 0; pass < 2; pass++) {
    const steps = 6;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
    }
    out.push(
      smoothOpen(
        jitter(points, rand, pass === 0 ? amp : amp * 0.7),
      ),
    );
  }
  return out;
}

function svg(width, height, body) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">`,
    body,
    `</svg>`,
    "",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** The banner: name, what I do, and a few primitives to hint at the work. */
function hero(theme) {
  const W = 980;
  const H = 210;
  const rand = rng(seedFrom("hero" + theme.name));

  const frame = smoothClosed(
    jitter(roundedRectPoints(8, 8, W - 16, H - 16, 22), rand, 1.6),
  );

  const nameX = 52;
  const parts = [
    `<path d="${frame}" stroke="${theme.faint}" stroke-width="2"/>`,
    `<text x="${nameX}" y="104" font-family="${FONT}" font-size="58" font-weight="700" fill="${theme.ink}" letter-spacing="-1.5">${esc(CONTENT.name)}</text>`,
  ];

  // A pen underline, sitting just under the name.
  for (const d of doubledLine(nameX + 2, 122, nameX + 300, 122, rng(seedFrom("under")), 1.8)) {
    parts.push(`<path d="${d}" stroke="${theme.accent}" stroke-width="2.4" stroke-linecap="round"/>`);
  }

  parts.push(
    `<text x="${nameX}" y="163" font-family="${FONT}" font-size="19" fill="${theme.soft}">${esc(CONTENT.tagline)}</text>`,
  );

  /*
   * Circle, triangle, square. The three primitives, drawn rather than
   * constructed, and sized to hold the right-hand third so the banner does not
   * have a hole in the middle of it.
   */
  const ox = W - 330;
  const oy = H / 2;
  const r = rng(seedFrom("primitives"));

  const circle = [];
  for (let i = 0; i <= 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    circle.push([ox + Math.cos(a) * 46, oy + Math.sin(a) * 46]);
  }
  parts.push(
    `<path d="${smoothOpen(jitter(circle, r, 1.8))}" stroke="${theme.soft}" stroke-width="2.4" stroke-linejoin="round"/>`,
  );

  const tri = jitter(
    [
      [ox + 128, oy - 46],
      [ox + 170, oy + 40],
      [ox + 86, oy + 40],
    ],
    r,
    1.8,
  );
  parts.push(
    `<path d="${smoothClosed(tri)}" stroke="${theme.soft}" stroke-width="2.4" stroke-linejoin="round"/>`,
  );

  const sq = jitter(roundedRectPoints(ox + 206, oy - 40, 80, 80, 10), r, 1.8);
  parts.push(
    `<path d="${smoothClosed(sq)}" stroke="${theme.accent}" stroke-width="2.4" stroke-linejoin="round"/>`,
  );

  return svg(W, H, parts.join(""));
}

/** A rule to sit between sections, with a small mark in the middle. */
function divider(theme) {
  const W = 980;
  const H = 26;
  const rand = rng(seedFrom("divider" + theme.name));
  const parts = [];
  for (const [x1, x2] of [
    [0, W / 2 - 26],
    [W / 2 + 26, W],
  ]) {
    for (const d of doubledLine(x1, 13, x2, 13, rand, 1.1)) {
      parts.push(`<path d="${d}" stroke="${theme.faint}" stroke-width="1.6" stroke-linecap="round"/>`);
    }
  }
  const dot = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    dot.push([W / 2 + Math.cos(a) * 6, 13 + Math.sin(a) * 6]);
  }
  parts.push(`<path d="${smoothOpen(jitter(dot, rand, 0.8))}" stroke="${theme.accent}" stroke-width="1.8"/>`);
  return svg(W, H, parts.join(""));
}

/**
 * A strip of hand-drawn chips.
 *
 * Every strip comes out the same width, with its chips centred, so that two
 * rows sitting under one another are drawn at the same scale. Sizing each to
 * its own content would make the shorter row's chips visibly larger, because
 * both rows are stretched to the same column width by `max-width`.
 */
const CHIP_CANVAS = 980;

function chips(theme, labels, key) {
  const font = 15;
  const padX = 17;
  const h = 38;
  const gap = 11;
  const rand = rng(seedFrom("chips" + key + theme.name));

  // Rough width of each label in the fallback sans, near enough for a chip.
  const widths = labels.map((l) => Math.max(52, Math.round(l.length * font * 0.56) + padX * 2));
  const content = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
  let x = Math.max(0, (CHIP_CANVAS - content) / 2);

  const parts = [];
  labels.forEach((label, i) => {
    const w = widths[i];
    const box = jitter(roundedRectPoints(x, 0, w, h, 12), rand, 1.1);
    parts.push(
      `<path d="${smoothClosed(box)}" stroke="${theme.soft}" stroke-width="1.7"/>`,
      `<text x="${round(x + w / 2)}" y="25" font-family="${FONT}" font-size="${font}" fill="${theme.ink}" text-anchor="middle">${esc(label)}</text>`,
    );
    x += w + gap;
  });

  return svg(CHIP_CANVAS, h, parts.join(""));
}

/** A project card: title, one-line description, and a couple of facts. */
function card(theme, { title, blurb, meta, badge }) {
  const W = 980;
  const H = 176;
  const rand = rng(seedFrom("card" + title + theme.name));

  const parts = [
    `<path d="${smoothClosed(jitter(roundedRectPoints(3, 3, W - 6, H - 6, 18), rand, 1.7))}" fill="${theme.card}" stroke="${theme.faint}" stroke-width="2"/>`,
    // The tab on the left, so the card reads as a card and not a banner.
    `<path d="${smoothClosed(jitter(roundedRectPoints(3, 3, 10, H - 6, 5), rand, 1.2))}" fill="${theme.accent}"/>`,
    `<text x="42" y="60" font-family="${FONT}" font-size="30" font-weight="700" fill="${theme.ink}" letter-spacing="-0.6">${esc(title)}</text>`,
    `<text x="42" y="98" font-family="${FONT}" font-size="17" fill="${theme.soft}">${esc(blurb)}</text>`,
  ];

  if (badge) {
    const bw = Math.round(badge.length * 8.5) + 26;
    parts.push(
      `<path d="${smoothClosed(jitter(roundedRectPoints(W - bw - 34, 26, bw, 30, 9), rand, 1))}" stroke="${theme.soft}" stroke-width="1.6"/>`,
      `<text x="${round(W - bw / 2 - 34)}" y="46" font-family="${FONT}" font-size="14" fill="${theme.soft}" text-anchor="middle">${esc(badge)}</text>`,
    );
  }

  parts.push(
    `<text x="42" y="140" font-family="${MONO}" font-size="14" fill="${theme.soft}">${esc(meta)}</text>`,
  );

  return svg(W, H, parts.join(""));
}

/* ------------------------------------------------------------------ */
/* Write them all                                                      */
/* ------------------------------------------------------------------ */

mkdirSync(OUT, { recursive: true });

const written = [];
function write(name, contents) {
  writeFileSync(join(OUT, name), contents);
  written.push(name);
}

for (const theme of [LIGHT, DARK]) {
  const suffix = theme.name;
  write(`hero-${suffix}.svg`, hero(theme));
  write(`divider-${suffix}.svg`, divider(theme));
  // Always numbered, even when there is only one, so adding a project is
  // purely additive and never renames a file the README already points at.
  CONTENT.cards.forEach((spec, i) => {
    write(`card-${i + 1}-${suffix}.svg`, card(theme, spec));
  });
  for (const [key, labels] of Object.entries(CONTENT.chipRows)) {
    write(`chips-${key}-${suffix}.svg`, chips(theme, labels, key));
  }
}

console.log(`wrote ${written.length} files to assets/`);
for (const name of written) console.log(`  ${name}`);
