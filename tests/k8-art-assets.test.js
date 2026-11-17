// The K8 art is part of the source-controlled frontend, not a remote CDN.
// Keep this manifest in sync with actual on-disk binaries, including the dragon.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, 'admin', 'public', 'k8-animals');
const MANIFEST = path.join(ART, 'assets-manifest.json');
const K8_MODEL = path.join(ROOT, 'admin', 'src', 'components', 'k8', 'k8Risk.mjs');
const VARIANTS = ['desktop', 'tablet', 'mobile'];

/** Read dimensions from the three WebP bitstream formats. */
const dimensions = bytes => {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', 'WebP RIFF signature');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', 'WebP file signature');
  const codec = bytes.toString('ascii', 12, 16);
  if (codec === 'VP8 ') {
    assert.deepEqual([...bytes.subarray(23, 26)], [0x9d, 0x01, 0x2a]);
    return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
  if (codec === 'VP8L') {
    assert.equal(bytes[20], 0x2f);
    return [
      1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
      1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | (bytes[22] >> 6)),
    ];
  }
  if (codec === 'VP8X') {
    return [
      1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    ];
  }
  throw new Error('Unsupported WebP codec: ' + codec);
};

describe('K8 Wildlife art delivery', () => {
  it('contains eleven matching animals and complete portrait/tablet/mobile assets', async () => {
    const { K8_ANIMALS } = await import(pathToFileURL(K8_MODEL).href);
    const data = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

    assert.deepEqual(data.missing_levels, [], 'no missing art levels');
    assert.equal(data.assets.length, 11);
    assert.equal(K8_ANIMALS.length, 11);
    assert.deepEqual(data.assets.map(item => item.level), Array.from({ length: 11 }, (_, n) => n));
    assert.deepEqual(data.assets.map(item => item.name), K8_ANIMALS.map(item =>
      item.name.toLowerCase().replaceAll(' ', '-')));
    assert.deepEqual(data.assets.map(item => item.character_side), K8_ANIMALS.map(item => item.place));

    const expected = new Set();
    for (const [index, entry] of data.assets.entries()) {
      assert.equal(entry.desktop.file, K8_ANIMALS[index].file);
      for (const variant of VARIANTS) {
        const info = entry[variant];
        const prefix = variant === 'desktop' ? '' : variant + '/';
        assert.equal(info.file, prefix + K8_ANIMALS[index].file);
        assert.match(info.sha256, /^[a-f0-9]{64}$/);
        const file = path.join(ART, info.file);
        assert.ok(file.startsWith(ART + path.sep), 'asset must be in art directory');
        const bytes = fs.readFileSync(file);
        assert.equal(bytes.length, info.bytes, info.file + ' byte length');
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
          info.sha256, info.file + ' SHA-256 checksum');
        assert.deepEqual(dimensions(bytes), info.size, info.file + ' image dimensions');
        assert.ok(info.size[0] > 0 && info.size[1] > 0, info.file + ' nonzero dimensions');
        if (variant === 'mobile') assert.ok(info.size[1] > info.size[0], 'portrait phone art');
        if (variant !== 'mobile') assert.ok(info.size[0] > info.size[1], 'landscape art');
        expected.add(info.file);
      }
    }

    // Reject silently omitted scenes or orphaned files left by a replacement.
    const actual = [
      ...fs.readdirSync(ART).filter(name => name.endsWith('.webp')),
      ...fs.readdirSync(path.join(ART, 'tablet')).filter(name => name.endsWith('.webp')).map(name => 'tablet/' + name),
      ...fs.readdirSync(path.join(ART, 'mobile')).filter(name => name.endsWith('.webp')).map(name => 'mobile/' + name),
    ];
    assert.equal(expected.size, 33);
    assert.deepEqual(actual.sort(), [...expected].sort());
  });
});
