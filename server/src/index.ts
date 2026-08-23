import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { config } from './utils/config';
import { pool, query } from './db/pool';
import { runMigrations } from './db/migrations';
import { logError, scrubbedLogger } from './utils/log';
import { auth } from './routes/auth';
import { tokens } from './routes/tokens';
import { oauth, purgeExpiredOAuthCodes } from './routes/oauth';
import { seedOAuthClients } from './utils/oauth-clients';
import { profiles } from './routes/profiles';
import { folders } from './routes/folders';
import { tags } from './routes/tags';
import { recipes } from './routes/recipes';
import { pantry } from './routes/pantry';
import { equipment } from './routes/equipment';
import { conversions } from './routes/conversions';
import { calendar } from './routes/calendar';
import { grocery } from './routes/grocery';
import { settings } from './routes/settings';
import { locations } from './routes/locations';
import { notifications } from './routes/notifications';
import { kitchen } from './routes/kitchen';
import { admin } from './routes/admin';
import { announcements } from './routes/announcements';
import { nutrition } from './routes/nutrition';
import { customNutrition } from './routes/custom-nutrition';
import { extractRecipe } from './routes/extract-recipe';
import { files } from './routes/files';
import { setup } from './routes/setup';
import { recipeIngredients } from './routes/recipe-ingredients';
import { userTutorials } from './routes/user-tutorials';
import { instanceMembers } from './routes/instance-members';
import { images } from './routes/images';
import { isEmailVerificationRequired } from './utils/system-config';

type Variables = {
  userId: string;
  userEmail: string;
};

export function buildApp(): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.use('*', scrubbedLogger());
  // The localhost connect-src entries exist for development (API traffic when
  // the frontend and API run on separate local ports). In production the app
  // and API share an origin, so 'self' covers everything; leaving localhost
  // open would let any process bound to those ports talk to the app origin.
  const connectSrc = ["'self'"];
  if (config.nodeEnv !== 'production') {
    connectSrc.push('http://localhost:8000', 'ws://localhost:8000');
  }

  app.use('*', secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc,
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
    xFrameOptions: 'DENY',
  }));
  app.use('/api/*', cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  app.use('/oauth/*', cors({
    origin: config.corsOrigin,
    credentials: true,
  }));

  // Embeds: the public recipe endpoint and image proxy are unauthenticated and
  // read-only, so they are CORS-open for any origin (recipe cards embedded on
  // third-party sites). The authenticated API stays locked to corsOrigin above.
  app.use('/api/recipes/public/*', cors({ origin: '*', credentials: false }));
  app.use('/api/images/proxy', cors({ origin: '*', credentials: false }));

  // Normalize trailing slashes on API routes: /api/recipes/ and /api/recipes
  // are the same resource. 308 preserves the method and body across the
  // redirect (POST /api/recipes/ keeps its payload).
  app.use('/api/*', async (c, next) => {
    const path = c.req.path;
    if (path.length > 1 && path.endsWith('/')) {
      const url = new URL(c.req.url);
      url.pathname = path.replace(/\/+$/, '');
      return c.redirect(url.toString(), 308);
    }
    await next();
  });

  // Cap request bodies so an unauthenticated endpoint can't be forced to
  // buffer multi-GB payloads (memory-exhaustion DoS). 10 MB covers the largest
  // legitimate writes (nutrition import batches are chunked at 500 rows) while
  // rejecting everything abusive.
  const rejectTooLarge = (c: import('hono').Context) =>
    c.json({ error: 'Request body too large' }, 413);
  app.use('/api/*', bodyLimit({ maxSize: 10 * 1024 * 1024, onError: rejectTooLarge }));
  app.use('/oauth/*', bodyLimit({ maxSize: 10 * 1024 * 1024, onError: rejectTooLarge }));

  // Reject syntactically invalid JSON bodies with a clean 400. Without this,
  // the SyntaxError thrown while route handlers parse the body surfaces as a
  // generic 500. Empty bodies (e.g. DELETE with a JSON Content-Type but no
  // payload) pass through untouched. The probe reads a clone of the stream so
  // the real body stays available to validators and handlers.
  app.use('/api/*', async (c, next) => {
    const contentType = c.req.header('Content-Type') || '';
    if (
      contentType.includes('application/json') &&
      !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)
    ) {
      let raw = '';
      try {
        raw = await c.req.raw.clone().text();
      } catch {
        await next();
        return;
      }
      if (raw.trim() !== '') {
        try {
          JSON.parse(raw);
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }
      }
    }
    await next();
  });

  // Dynamic API responses must never be cached by shared/proxy caches (session
  // data, tokens, and per-instance state). Endpoints like the image proxy that
  // deliberately set their own Cache-Control are left untouched.
  app.use('/api/*', async (c, next) => {
    await next();
    if (!c.res.headers.has('Cache-Control')) {
      c.header('Cache-Control', 'no-store');
    }
  });

  // Security headers — X-Frame-Options and X-Content-Type-Options can only be
  // set via HTTP headers (browsers ignore <meta http-equiv> for these).
  app.use('*', async (c, next) => {
    await next();
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  // Serve built frontend static files in production
  if (config.publicDir && existsSync(config.publicDir)) {
    app.use('/assets/*', serveStatic({ root: config.publicDir }));
    app.use('/favicon.svg', serveStatic({ root: config.publicDir }));
    app.use('/favicon.ico', serveStatic({ root: join(config.publicDir, 'images') }));
    app.use('/images/*', serveStatic({ root: config.publicDir }));
    app.use('/embed.js', serveStatic({ root: config.publicDir }));
    app.use('/og-image.png', serveStatic({ root: config.publicDir }));
    app.use('/manifest.json', serveStatic({ root: config.publicDir }));
    app.get('/timer.wav', async (c) => {
      try {
        const file = await readFile(join(config.publicDir, 'timer.wav'));
        return c.body(file, 200, { 'Content-Type': 'audio/wav' });
      } catch {
        return c.json({ error: 'Sound file not found' }, 404);
      }
    });
  }

  // Serve setup seed files (nutrition_foods.json) so the Setup page can fetch
  // them during first-boot bootstrap. The raw file server is only reachable
  // while no users exist: post-bootstrap the Setup page is gone and the
  // superadmin's Settings import uses the auth-gated /api/setup/files instead,
  // so keeping the static mount open would expose the nutrition dataset (and
  // anything else in the setup dir) unauthenticated.
  if (config.setupDir && existsSync(config.setupDir)) {
    app.use('/setup/*', async (c, next) => {
      const profileResult = await query('SELECT COUNT(*) FROM profiles');
      const hasUsers = parseInt(profileResult.rows[0].count, 10) > 0;
      if (hasUsers) {
        return c.json({ error: 'Not found' }, 404);
      }
      await next();
    });
    app.use('/setup/*', serveStatic({ root: join(config.setupDir, '..') }));
  }

  app.route('/api/auth', auth);
  app.route('/api/tokens', tokens);
  app.route('/oauth', oauth);
  app.route('/api/profiles', profiles);
  app.route('/api/folders', folders);
  app.route('/api/tags', tags);
  app.route('/api/recipes', recipes);
  app.route('/api/pantry', pantry);
  app.route('/api/equipment', equipment);
  app.route('/api/conversions', conversions);
  app.route('/api/calendar', calendar);
  app.route('/api/grocery', grocery);
  app.route('/api/settings', settings);
  app.route('/api/locations', locations);
  app.route('/api/notifications', notifications);
  app.route('/api/kitchen', kitchen);
  app.route('/api/admin', admin);
  app.route('/api/announcements', announcements);
  app.route('/api/nutrition', nutrition);
  app.route('/api/custom-nutrition', customNutrition);
  app.route('/api/extract-recipe', extractRecipe);
  app.route('/api/files', files);
  app.route('/api/setup', setup);
  app.route('/api/recipe-ingredients', recipeIngredients);
  app.route('/api/user-tutorials', userTutorials);
  app.route('/api/instance-members', instanceMembers);
  app.route('/api/images', images);

  app.get('/api/config', async (c) => {
    return c.json({
      enableAdminFeatures: config.enableAdminFeatures,
      requiresEmailVerification: await isEmailVerificationRequired(),
    });
  });

  app.get('/api/health', async (c) => {
    try {
      const result = await pool.query('SELECT 1 AS ok');
      return c.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return c.json({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      }, 503);
    }
  });

  app.onError((err, c) => {
    logError('Unhandled error', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  // SPA fallback — serves index.html for any non-API route not matched above
  app.notFound(async (c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Not found' }, 404);
    }
    try {
      const content = await readFile(join(config.publicDir, 'index.html'), 'utf-8');
      return c.html(content);
    } catch {
      return c.json({ error: 'Not found' }, 404);
    }
  });

  return app;
}

async function start() {
  try {
    await runMigrations();
  } catch (err) {
    logError('Failed to run database migrations', err);
  }

  try {
    await seedOAuthClients();
  } catch (err) {
    logError('Failed to seed OAuth clients', err);
  }

  try {
    await purgeExpiredOAuthCodes();
  } catch (err) {
    logError('Failed to purge expired OAuth codes', err);
  }

  const server = serve({
    fetch: app.fetch,
    port: config.port,
  }, (info) => {
    console.log(`PantryButler API server running on http://localhost:${info.port}`);
    console.log(`Health check: http://localhost:${info.port}/api/health`);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await pool.end();
    server.close();
    process.exit(0);
  });
}

const app = buildApp();

export default app;

// Start the HTTP server only when this file is run directly (not when imported
// by tests or other tooling). Importing buildApp() must not bind a port.
const isDirectRun = typeof require !== 'undefined' && require.main === module;
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  start().catch((err) => {
    logError('Server startup failed', err);
    process.exit(1);
  });
}
