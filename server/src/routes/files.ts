import { Hono } from 'hono';
import { requireAuth, requireJwt, type AuthVariables } from '../middleware/auth';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from '../db/pool';

const UPLOADS_DIR = path.resolve(process.cwd(), 'server/uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const files = new Hono<{ Variables: AuthVariables }>();

const BUCKET_RE = /^[a-zA-Z0-9_-]+$/;
const FOLDER_RE = /^[a-zA-Z0-9_./-]*$/;

function sanitizeSegment(segment: string, allowSlashes: boolean): string {
  const cleaned = segment.replace(/\.\./g, '').replace(/[\\]/g, '/');
  if (!allowSlashes) {
    return cleaned.replace(/\//g, '');
  }
  return cleaned;
}

function isInside(baseDir: string, target: string): boolean {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(target);
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + path.sep);
}

function detectImageExt(buffer: Buffer): string | null {
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return '.png';
  }
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return '.jpg';
  }
  if (buffer.length > 11 && buffer.toString('ascii', 0, 11) === 'GIF89a') {
    return '.gif';
  }
  if (buffer.length > 11 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return '.webp';
  }
  return null;
}

files.post('/upload', requireAuth, requireJwt, async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  const bucket = body['bucket'];
  const folder = body['folder'];

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Missing or invalid file field' }, 400);
  }

  if (!bucket || typeof bucket !== 'string' || !BUCKET_RE.test(bucket)) {
    return c.json({ error: 'Missing or invalid bucket field' }, 400);
  }

  if (folder !== undefined && folder !== null && typeof folder !== 'string') {
    return c.json({ error: 'Invalid folder field' }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File too large. Maximum size is 5MB' }, 400);
  }

  // Reject anything that isn't a real image by inspecting magic bytes; the
  // stored extension is derived from the content, never from the client name.
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = detectImageExt(buffer);
  if (!ext) {
    return c.json({ error: 'Invalid file content' }, 400);
  }

  const uniqueName = `${crypto.randomUUID()}${ext}`;
  const subDir = sanitizeSegment(typeof folder === 'string' && folder ? folder : '_root', true);
  const destDir = path.resolve(UPLOADS_DIR, bucket, subDir);

  if (!isInside(UPLOADS_DIR, destDir)) {
    return c.json({ error: 'Invalid path' }, 400);
  }

  await mkdir(destDir, { recursive: true });

  const filePath = path.resolve(destDir, uniqueName);
  await writeFile(filePath, buffer);

  const url = `/api/files/${bucket}/${subDir}/${uniqueName}`;
  // Record ownership so DELETE can be scoped to the uploader. Duplicate paths
  // (theoretically impossible with UUIDs) are tolerated silently.
  await query('INSERT INTO user_files (path, user_id) VALUES ($1, $2) ON CONFLICT (path) DO NOTHING', [
    url,
    c.get('userId'),
  ]);
  return c.json({ url }, 201);
});

// Recipe images are public content (displayed on public recipe pages to any
// visitor) and are referenced from plain <img> tags, which cannot attach the
// Authorization header used by the SPA. Serving them unauthenticated restores
// image display; upload/delete stay behind requireAuth and the path-traversal
// guards below still apply.
files.get('/:bucket/:folder/:filename', async (c) => {
  const { bucket, folder, filename } = c.req.param();

  const safe = (s: string) => s.replace(/\.\./g, '').replace(/[\\/]/g, '');
  const filePath = path.resolve(UPLOADS_DIR, safe(bucket), safe(folder), safe(filename));

  if (!isInside(UPLOADS_DIR, filePath)) {
    return c.json({ error: 'Invalid path' }, 400);
  }

  if (!existsSync(filePath)) {
    return c.json({ error: 'File not found' }, 404);
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';

  const buffer = await readFile(filePath);
  return c.newResponse(buffer, 200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
});

files.delete('/', requireAuth, requireJwt, async (c) => {
  const { bucket, path: filePathToDelete } = await c.req.json();

  if (!bucket || !filePathToDelete) {
    return c.json({ error: 'Missing bucket or path' }, 400);
  }

  if (typeof bucket !== 'string' || typeof filePathToDelete !== 'string') {
    return c.json({ error: 'bucket and path must be strings' }, 400);
  }

  if (!BUCKET_RE.test(bucket)) {
    return c.json({ error: 'Invalid bucket' }, 400);
  }

  const safePath = sanitizeSegment(filePathToDelete, true);
  const fullPath = path.resolve(UPLOADS_DIR, bucket, safePath);

  if (!isInside(UPLOADS_DIR, fullPath)) {
    return c.json({ error: 'Invalid path' }, 400);
  }

  // Ownership check: only the uploader (or a system superadmin) may delete a
  // file. Files with no ownership record predate the user_files table and can
  // only be removed by a superadmin, since uploader identity is unprovable.
  const userId = c.get('userId');
  const url = `/api/files/${bucket}/${safePath}`;
  const owned = await query('SELECT 1 FROM user_files WHERE path = $1 AND user_id = $2', [url, userId]);
  if (owned.rows.length === 0) {
    const caller = await query('SELECT role FROM profiles WHERE id = $1', [userId]);
    if (caller.rows.length === 0 || caller.rows[0].role !== 'superadmin') {
      return c.json({ error: 'Forbidden: not the owner of this file' }, 403);
    }
  }

  try {
    await unlink(fullPath);
    await query('DELETE FROM user_files WHERE path = $1', [url]);
    return c.json({ success: true });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return c.json({ error: 'File not found' }, 404);
    }
    return c.json({ error: 'Failed to delete file' }, 500);
  }
});

export { files };
