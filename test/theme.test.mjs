import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTheme, resolveTheme } from "../site/theme.js";

test("normalizeTheme accepts only supported preferences", () => {
  assert.equal(normalizeTheme("light"), "light");
  assert.equal(normalizeTheme("dark"), "dark");
  assert.equal(normalizeTheme("system"), "system");
  assert.equal(normalizeTheme("unknown"), "system");
  assert.equal(normalizeTheme(null), "system");
});

test("resolveTheme handles manual and system preferences", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});
