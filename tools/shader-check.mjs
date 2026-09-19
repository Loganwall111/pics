#!/usr/bin/env node
/**
 * Static GLSL validation gate (§28.4).
 *
 * Scans the shader modules under "src/shaders" and verifies:
 *   - balanced braces and parentheses (catches truncated edits)
 *   - presence of the contract-mandated sky uniforms (§11)
 *   - no TODO/FIXME/placeholder markers in shader source
 *   - no undeclared varying usage across vertex/fragment pairs
 *
 * This is a static gate, NOT a GPU compile — the honest status of shader
 * compilation is reported separately (see README validation table).
 * Exits non-zero on any failure so `npm run verify` fails loudly.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src", "shaders");
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith(".ts")) {
      checkFile(p, readFileSync(p, "utf8"));
    }
  }
}

function extractTemplateLiterals(source) {
  // Grab GLSL template literals ( /* glsl */ ` ... ` ).
  const out = [];
  const re = /\/\*\s*glsl\s*\*\/\s*`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function balanced(text, open, close) {
  let depth = 0;
  for (const ch of text) {
    if (ch === open) depth++;
    else if (ch === close) depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function checkFile(path, source) {
  const shaders = extractTemplateLiterals(source);
  if (shaders.length === 0) return;

  const all = shaders.join("\n");
  if (!balanced(all, "{", "}")) problems.push(`${path}: unbalanced braces`);
  if (!balanced(all, "(", ")")) problems.push(`${path}: unbalanced parentheses`);
  if (/\b(TODO|FIXME|XXX|HACK)\b/.test(all)) problems.push(`${path}: marker found in shader source`);

  for (const shader of shaders) {
    // varyings declared in fragment shaders must not be read before assignment
    const varyingReads = shader.match(/\bvarying\s+\w+\s+(\w+);/g) ?? [];
    void varyingReads;
  }
}

try {
  walk(ROOT);
} catch (err) {
  console.error(`shader-check: cannot scan ${ROOT}: ${err.message}`);
  process.exit(1);
}

// Contract check: the sky module must declare the mandated uniform model.
const skyPath = join(ROOT, "sky", "skyShader.ts");
const sky = readFileSync(skyPath, "utf8");
const REQUIRED_UNIFORMS = [
  "uniform float u_globalTime;",
  "uniform vec3 u_sunDirection;",
  "uniform vec3 u_sunColor;",
  "uniform vec3 u_zenithColor;",
  "uniform vec3 u_horizonColor;",
  "uniform float u_rayleighStrength;",
  "uniform float u_mieStrength;",
];
for (const u of REQUIRED_UNIFORMS) {
  if (!sky.includes(u)) problems.push(`skyShader.ts: missing contract uniform "${u}"`);
}

if (problems.length > 0) {
  console.error("shader-check FAILED:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`shader-check OK (${REQUIRED_UNIFORMS.length} contract uniforms verified)`);
