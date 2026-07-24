import path from 'path';
import { promises as fs } from 'fs';
import { HACKATHON_DOCS_ROOT, ALLOWED_UPLOAD_IMAGE_EXTENSIONS, MIME_TO_IMAGE_EXTENSION } from '../config';

export function sanitizePathSegment(value: string): string {
  // SECURITY: strict whitelist — refuses `.` and `..` to prevent path traversal
  // (e.g. `..%2F..%2F` jumping out of HACKATHON_DOCS_ROOT).
  if (typeof value !== 'string') {
    throw new Error('Path segment must be a string');
  }
  if (value.length === 0 || value.length > 64) {
    throw new Error('Path segment length must be 1..64');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error('Path segment must match [a-zA-Z0-9_-]+');
  }
  return value;
}

export function sanitizeFileStem(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

export function isMarkdownFileName(value: string): boolean {
  const ext = path.extname(value).toLowerCase();
  return ext === '.md' || ext === '.markdown';
}

export function isPDFFileName(value: string): boolean {
  const ext = path.extname(value).toLowerCase();
  return ext === '.pdf';
}

export function isDocumentFileName(value: string): boolean {
  return isMarkdownFileName(value) || isPDFFileName(value);
}

export function normalizeDocumentFileName(value: string | undefined): string {
  const fileName = path.basename(value?.trim() || 'README.md');
  const parsed = path.parse(fileName);
  const baseName = sanitizeFileStem(parsed.name) || 'README';
  if (isPDFFileName(fileName)) {
    return `${baseName}.pdf`;
  }
  const extension = isMarkdownFileName(fileName) ? parsed.ext.toLowerCase() : '.md';
  return `${baseName}${extension}`
}

export function normalizeUploadedImageFileName(value: string | undefined): string {
  const fallback = 'image';
  const baseName = path.basename(value?.trim() || fallback);
  const parsed = path.parse(baseName);
  const safeStem = sanitizeFileStem(parsed.name) || fallback;
  const ext = parsed.ext.toLowerCase();
  return `${safeStem}${ext}`;
}

export function resolveUploadedImageExtension(fileName: string, contentType: string | undefined): string | null {
  const nameExt = path.extname(fileName).toLowerCase();
  if (ALLOWED_UPLOAD_IMAGE_EXTENSIONS.has(nameExt)) return nameExt;

  const normalizedType = contentType?.split(';')[0]?.trim().toLowerCase();
  if (!normalizedType) return null;

  return MIME_TO_IMAGE_EXTENSION[normalizedType] || null;
}

export function getHackathonDocsDir(hackathonId: string): string {
  return path.join(HACKATHON_DOCS_ROOT, sanitizePathSegment(hackathonId));
}

export async function listHackathonDocumentFiles(hackathonId: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(getHackathonDocsDir(hackathonId), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && isDocumentFileName(entry.name))
      .map((entry) => entry.name);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export function compareDocumentFilePriority(fileA: string, fileB: string): number {
  const priority = (fileName: string) => {
    const lower = fileName.toLowerCase();
    const isPdfA = isPDFFileName(fileName);
    const isMdA = isMarkdownFileName(fileName);
    if (lower === 'readme.md' || lower === 'readme.markdown') return 0;
    if (lower === 'index.md' || lower === 'index.markdown') return 1;
    if (isMdA) return 2;
    if (isPdfA) return 3;
    return 4;
  };

  return priority(fileA) - priority(fileB) || fileA.localeCompare(fileB);
}

export async function readHackathonMarkdownDoc(hackathonId: string) {
  const files = await listHackathonDocumentFiles(hackathonId);
  if (files.length === 0) return null;

  const fileName = [...files].sort(compareDocumentFilePriority)[0];
  const filePath = path.join(getHackathonDocsDir(hackathonId), fileName);
  const stats = await fs.stat(filePath);

  if (isPDFFileName(fileName)) {
    const content = await fs.readFile(filePath);
    return {
      fileName,
      content: content.toString('base64'),
      contentType: 'application/pdf',
      updatedAt: stats.mtime.toISOString(),
    };
  }

  const content = await fs.readFile(filePath, 'utf8');
  return {
    fileName,
    content,
    contentType: 'text/markdown',
    updatedAt: stats.mtime.toISOString(),
  };
}

export async function saveHackathonMarkdownDoc(hackathonId: string, fileName: string | undefined, content: string, isBase64: boolean = false) {
  const docsDir = getHackathonDocsDir(hackathonId);
  const normalizedFileName = normalizeDocumentFileName(fileName);
  const existingFiles = await listHackathonDocumentFiles(hackathonId);

  await fs.mkdir(docsDir, { recursive: true });
  await Promise.all(
    existingFiles.map((existingFile) => fs.unlink(path.join(docsDir, existingFile)))
  );

  const filePath = path.join(docsDir, normalizedFileName);

  if (isBase64 || isPDFFileName(normalizedFileName)) {
    const buffer = Buffer.from(content, 'base64');
    await fs.writeFile(filePath, buffer);
  } else {
    await fs.writeFile(filePath, content, 'utf8');
  }

  const stats = await fs.stat(filePath);
  return {
    fileName: normalizedFileName,
    content,
    updatedAt: stats.mtime.toISOString(),
  };
}

export async function deleteHackathonMarkdownDoc(hackathonId: string) {
  const docsDir = getHackathonDocsDir(hackathonId);
  const files = await listHackathonDocumentFiles(hackathonId);
  if (files.length === 0) return false;

  await Promise.all(files.map((fName) => fs.unlink(path.join(docsDir, fName))));

  try {
    await fs.rmdir(docsDir);
  } catch {
    // Ignore non-empty or already removed directories.
  }

  return true;
}
