import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readEntries, renderArchive, renderArticle, slugify } from '../scripts/generate-writing.mjs';

test('slugify creates clean permanent route segments', () => {
  assert.equal(slugify('Why Objects Should Explain Themselves'), 'why-objects-should-explain-themselves');
});

test('drafts are excluded and published markdown renders as static HTML', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zach-writing-'));
  fs.writeFileSync(path.join(directory, 'public.md'), '---\ntitle: A public thought\ndate: 2026-08-17\ntype: essay\npublished: true\ntags: [design]\n---\n## Clear heading\n\nReadable body.');
  fs.writeFileSync(path.join(directory, 'draft.md'), '---\ntitle: Private thought\npublished: false\n---\nSecret body.');
  const entries = readEntries(directory);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].slug, 'public');
  assert.match(renderArticle(entries[0]), /<article>/);
  assert.match(renderArticle(entries[0]), /<h2>Clear heading<\/h2>/);
  assert.doesNotMatch(renderArchive(entries), /Private thought/);
  fs.rmSync(directory, { recursive: true, force: true });
});
