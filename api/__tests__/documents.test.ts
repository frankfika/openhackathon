import { describe, expect, it, beforeEach, vi } from 'vitest';

// Configure env BEFORE importing modules that read it
const testRoot = `/tmp/oh-docs-mock-${process.pid}-${Math.random().toString(36).slice(2)}`;
process.env.HACKATHON_DOCS_DIR = testRoot;

vi.mock('../config', async () => {
  const actual = await vi.importActual<typeof import('../config')>('../config');
  return {
    ...actual,
    HACKATHON_DOCS_ROOT: testRoot,
    ALLOWED_UPLOAD_IMAGE_EXTENSIONS: actual.ALLOWED_UPLOAD_IMAGE_EXTENSIONS,
    MIME_TO_IMAGE_EXTENSION: actual.MIME_TO_IMAGE_EXTENSION,
  };
});

const { promises: fs } = await import('fs');
await import('path'); // path module registered for any helper that needs it

const {
  sanitizePathSegment,
  sanitizeFileStem,
  isMarkdownFileName,
  isPDFFileName,
  isDocumentFileName,
  normalizeDocumentFileName,
  normalizeUploadedImageFileName,
  resolveUploadedImageExtension,
  compareDocumentFilePriority,
  listHackathonDocumentFiles,
  readHackathonMarkdownDoc,
  saveHackathonMarkdownDoc,
  deleteHackathonMarkdownDoc,
} = await import('../utils/documents');

let hackathonId: string;

beforeEach(async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  hackathonId = 'h1';
});

describe('sanitizePathSegment / sanitizeFileStem', () => {
  it('sanitizePathSegment throws on directory separators and unsafe characters', () => {
    // SECURITY: stricter contract — any character outside [a-zA-Z0-9_-] is rejected
    // so path traversal (e.g. `..%2F..%2F`) cannot reach HACKATHON_DOCS_ROOT.
    expect(() => sanitizePathSegment('abc/def:ghi?jkl')).toThrow(/Path segment/);
    expect(() => sanitizePathSegment('..')).toThrow(/Path segment/);
    expect(() => sanitizePathSegment('foo.bar')).toThrow(/Path segment/);
    expect(() => sanitizePathSegment('')).toThrow(/Path segment/);
    expect(sanitizePathSegment('valid-id_42')).toBe('valid-id_42');
  });

  it('sanitizeFileStem strips control characters', () => {
    expect(sanitizeFileStem('foo\u0000bar<>:"/\\|?*baz')).toBe('foo_bar_________baz');
  });
});

describe('file extension helpers', () => {
  it('isMarkdownFileName matches .md / .markdown case-insensitively', () => {
    expect(isMarkdownFileName('README.md')).toBe(true);
    expect(isMarkdownFileName('Guide.MD')).toBe(true);
    expect(isMarkdownFileName('doc.markdown')).toBe(true);
    expect(isMarkdownFileName('README.txt')).toBe(false);
  });

  it('isPDFFileName matches .pdf only', () => {
    expect(isPDFFileName('guide.pdf')).toBe(true);
    expect(isPDFFileName('guide.PDF')).toBe(true);
    expect(isPDFFileName('guide.txt')).toBe(false);
  });

  it('isDocumentFileName is the union', () => {
    expect(isDocumentFileName('a.md')).toBe(true);
    expect(isDocumentFileName('a.pdf')).toBe(true);
    expect(isDocumentFileName('a.txt')).toBe(false);
  });
});

describe('normalizeDocumentFileName', () => {
  it('falls back to README.md when input is missing', () => {
    expect(normalizeDocumentFileName(undefined)).toBe('README.md');
    expect(normalizeDocumentFileName('')).toBe('README.md');
  });

  it('forces .md extension when not markdown or pdf', () => {
    expect(normalizeDocumentFileName('guide.txt')).toBe('guide.md');
  });

  it('preserves .pdf extension', () => {
    expect(normalizeDocumentFileName('Guide.PDF')).toBe('Guide.pdf');
  });

  it('strips path traversal and unsafe characters', () => {
    expect(normalizeDocumentFileName('../../etc/passwd.md')).toBe('passwd.md');
  });
});

describe('normalizeUploadedImageFileName', () => {
  it('defaults stem to "image" when input is missing or unsafe', () => {
    expect(normalizeUploadedImageFileName(undefined)).toBe('image');
    expect(normalizeUploadedImageFileName('')).toBe('image');
    expect(normalizeUploadedImageFileName('   ')).toBe('image');
  });

  it('strips directory parts but keeps the extension', () => {
    expect(normalizeUploadedImageFileName('/tmp/foo.png')).toBe('foo.png');
  });
});

describe('resolveUploadedImageExtension', () => {
  it('returns the file extension when in the allow-list', () => {
    expect(resolveUploadedImageExtension('a.png', 'image/png')).toBe('.png');
    expect(resolveUploadedImageExtension('a.JPG', 'image/jpeg')).toBe('.jpg');
  });

  it('falls back to content-type when extension is unknown', () => {
    expect(resolveUploadedImageExtension('a', 'image/webp')).toBe('.webp');
  });

  it('returns null when neither file nor content-type is recognized', () => {
    expect(resolveUploadedImageExtension('a.bin', 'application/octet-stream')).toBeNull();
    expect(resolveUploadedImageExtension('a.png', undefined)).toBe('.png'); // filename wins
    expect(resolveUploadedImageExtension('a.bin', undefined)).toBeNull();
  });
});

describe('compareDocumentFilePriority', () => {
  it('prefers README > INDEX > other md > pdf > everything else', () => {
    expect(compareDocumentFilePriority('README.md', 'a.pdf')).toBeLessThan(0);
    expect(compareDocumentFilePriority('index.md', 'a.md')).toBeLessThan(0);
    expect(compareDocumentFilePriority('a.md', 'a.pdf')).toBeLessThan(0);
    expect(compareDocumentFilePriority('a.pdf', 'a.txt')).toBeLessThan(0);
  });

  it('falls back to lexicographic order when priorities match', () => {
    expect(compareDocumentFilePriority('a.md', 'b.md')).toBeLessThan(0);
  });
});

describe('hackathon docs file I/O', () => {
  it('returns [] when no docs directory exists', async () => {
    const files = await listHackathonDocumentFiles(hackathonId);
    expect(files).toEqual([]);
  });

  it('reads back a saved markdown doc', async () => {
    const result = await saveHackathonMarkdownDoc(hackathonId, 'guide.md', '# Hello\n', false);
    expect(result.fileName).toBe('guide.md');

    const read = await readHackathonMarkdownDoc(hackathonId);
    expect(read).not.toBeNull();
    expect(read?.content).toBe('# Hello\n');
    expect(read?.contentType).toBe('text/markdown');
  });

  it('saves PDF in base64 form and reads it back as base64', async () => {
    const fakePdfB64 = Buffer.from('%PDF-1.4 fake').toString('base64');
    await saveHackathonMarkdownDoc(hackathonId, 'guide.pdf', fakePdfB64, true);

    const read = await readHackathonMarkdownDoc(hackathonId);
    expect(read?.contentType).toBe('application/pdf');
    expect(read?.content).toBe(fakePdfB64);
  });

  it('delete removes the directory entries', async () => {
    await saveHackathonMarkdownDoc(hackathonId, 'README.md', '# Hi', false);
    const deleted = await deleteHackathonMarkdownDoc(hackathonId);
    expect(deleted).toBe(true);
    const after = await listHackathonDocumentFiles(hackathonId);
    expect(after).toEqual([]);
  });

  it('prefers README.md over other files when reading', async () => {
    await saveHackathonMarkdownDoc(hackathonId, 'random.md', '# random', false);
    await saveHackathonMarkdownDoc(hackathonId, 'README.md', '# top', false);
    const read = await readHackathonMarkdownDoc(hackathonId);
    expect(read?.fileName).toBe('README.md');
    expect(read?.content).toBe('# top');
  });

  it('saving a new doc clears previously stored docs', async () => {
    await saveHackathonMarkdownDoc(hackathonId, 'old.md', 'old', false);
    await saveHackathonMarkdownDoc(hackathonId, 'new.md', 'new', false);
    const files = await listHackathonDocumentFiles(hackathonId);
    expect(files).toEqual(['new.md']);
  });
});
