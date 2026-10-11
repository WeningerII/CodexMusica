// Private Site -> deterministic reader boundary. Capabilities never enter URLs.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import {
  canonicalReaderQuery,
  canonicalReaderSigningInput,
  READER_BODY_BYTES,
  READER_CONTRACT_VERSION,
} from './reader_protocol.js';

export { canonicalReaderQuery, READER_BODY_BYTES, READER_CONTRACT_VERSION };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
const scalar = (value) => (typeof value === 'string' ? value : '');
const validBinding = (value) => /^[A-Za-z0-9_.:-]{1,200}$/.test(value);

export function canonicalReaderRequest({
  method,
  path,
  body = '',
  site = '',
  viewer = '',
  job = '',
  attempt = '',
  generation = '',
  idempotency = '',
  capability = '',
  time,
  nonce,
}) {
  return canonicalReaderSigningInput({
    method,
    path,
    body_sha256: sha256(body),
    capability_sha256: sha256(capability),
    site,
    viewer,
    job,
    attempt,
    generation,
    idempotency,
    time,
    nonce,
  });
}

export function signReaderRequest({
  secret,
  now = Date.now(),
  nonce = randomBytes(24).toString('hex'),
  body = '',
  ...fields
}) {
  const time = String(Math.floor(now / 1000));
  const headers = {
    'x-reader-site': fields.site || '',
    'x-reader-viewer': fields.viewer || '',
    'x-reader-job': fields.job || '',
    'x-reader-attempt': String(fields.attempt ?? ''),
    'x-reader-generation': String(fields.generation ?? ''),
    'x-reader-idempotency': fields.idempotency || '',
    'x-reader-capability': fields.capability || '',
    'x-reader-time': time,
    'x-reader-nonce': nonce,
  };
  headers['x-reader-signature'] = createHmac('sha256', secret)
    .update(canonicalReaderRequest({ ...fields, body, time, nonce }))
    .digest('hex');
  return headers;
}

export function createReaderAuthenticator({ secret, site, now = Date.now, windowMs = 300000 }) {
  const seen = new Map();
  return (req, _res, next) => {
    try {
      if (!secret || Buffer.byteLength(secret) < 32 || !validBinding(site))
        throw fail('READER_UNAVAILABLE', 'The private reader bridge is not configured.', 503);
      const header = (name) => scalar(req.headers[name]);
      const binding = {
        method: req.method,
        path: req.originalUrl,
        body: req.readerRawBody || Buffer.alloc(0),
        site: header('x-reader-site'),
        viewer: header('x-reader-viewer'),
        job: header('x-reader-job'),
        attempt: header('x-reader-attempt'),
        generation: header('x-reader-generation'),
        idempotency: header('x-reader-idempotency'),
        capability: header('x-reader-capability'),
        time: header('x-reader-time'),
        nonce: header('x-reader-nonce'),
      };
      if (
        binding.site !== site ||
        !validBinding(binding.viewer) ||
        !/^\d{10,13}$/.test(binding.time) ||
        !/^[a-f0-9]{32,128}$/.test(binding.nonce) ||
        (binding.attempt && !/^\d{1,12}$/.test(binding.attempt)) ||
        (binding.generation && !/^\d{1,12}$/.test(binding.generation)) ||
        Math.abs(now() - Number(binding.time) * 1000) > windowMs
      )
        throw fail('BAD_SIGNATURE', 'The reader request authentication is invalid.', 401);
      if (binding.body.length > READER_BODY_BYTES)
        throw fail('RESOURCE_LIMIT', 'The reader request exceeds the byte limit.', 413);
      if (['POST', 'DELETE'].includes(req.method) && !validBinding(binding.idempotency))
        throw fail('BAD_REQUEST', 'A private control request needs an idempotency key.');
      const canonical = canonicalReaderRequest(binding);
      const supplied = header('x-reader-signature');
      const expected = createHmac('sha256', secret).update(canonical).digest('hex');
      if (
        !/^[a-f0-9]{64}$/.test(supplied) ||
        !timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex'))
      )
        throw fail('BAD_SIGNATURE', 'The reader request authentication is invalid.', 401);
      const replayKey = `${site}:${binding.nonce}`;
      const digest = sha256(canonical);
      const prior = seen.get(replayKey);
      if (prior && prior.digest !== digest)
        throw fail('REPLAY_CONFLICT', 'A nonce was reused for a changed reader request.', 409);
      // Exact repeats are safe: mutating actions also have durable store receipts.
      if (!prior) seen.set(replayKey, { digest, expires: now() + windowMs });
      for (const [key, entry] of seen) if (entry.expires < now()) seen.delete(key);
      if (seen.size > 16384)
        throw fail('RESOURCE_LIMIT', 'Reader authentication admission is full.', 429);
      req.readerAuth = {
        ...binding,
        digest: sha256(
          JSON.stringify({
            method: binding.method,
            path: binding.path,
            body_hash: sha256(binding.body),
            attempt: binding.attempt,
            generation: binding.generation,
          })
        ),
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function publicReaderJob(record) {
  return Object.fromEntries(
    [
      'id',
      'state',
      'identity',
      'attempt',
      'generation',
      'progress',
      'coverage',
      'manifest_hash',
      'created_at',
      'updated_at',
      'accessed_at',
      'expires_at',
      'lease_expires_at',
      'reason',
      'cancel_requested',
      'deferred_requeue',
    ]
      .filter((key) => record[key] !== undefined)
      .map((key) => [key, record[key]])
  );
}

export function validateRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.contract_version !== 1)
    throw fail('CONTRACT_MISMATCH', 'Reader contract_version must be 1.');
  for (const field of ['snapshot_id', 'reading_unit_id', 'reading_revision'])
    if (!validBinding(input[field])) throw fail('BAD_REQUEST', `A valid ${field} is required.`);
  if (
    input.declaration_set !== undefined &&
    (!input.declaration_set ||
      typeof input.declaration_set !== 'object' ||
      Array.isArray(input.declaration_set))
  )
    throw fail('INVALID_DECLARATION', 'The declaration set must be a JSON object.');
  const requested = input.requested_layers ?? ['sound', 'form', 'rhythm', 'language'];
  if (
    !Array.isArray(requested) ||
    requested.length > 4 ||
    requested.some((layer) => !['sound', 'form', 'rhythm', 'language'].includes(layer))
  )
    throw fail('UNSUPPORTED_METHOD', 'Requested layers must be sound, form, rhythm or language.');
  if (
    input.requested_methods !== undefined &&
    (!Array.isArray(input.requested_methods) ||
      input.requested_methods.length > 256 ||
      input.requested_methods.some((id) => !validBinding(id)))
  )
    throw fail(
      'UNSUPPORTED_METHOD',
      'Explicit method requests must be registered method identities.'
    );
  if (
    Object.keys(input).some(
      (key) =>
        ![
          'contract_version',
          'snapshot_id',
          'reading_unit_id',
          'reading_revision',
          'declaration_set',
          'requested_layers',
          'requested_methods',
          'idempotency_key',
        ].includes(key)
    )
  )
    throw fail('BAD_REQUEST', 'The analysis request contains an unknown field.');
  return {
    ...input,
    declaration_set: input.declaration_set ?? {},
    requested_layers: [...new Set(requested)].sort(),
  };
}

/**
 * The one create pipeline both browser families run (the Site bridge here and
 * /library/v1 in library_viewer_routes.js): resolve collection defaults, pin
 * the identity, create (or replay) the job, wake the scheduler.
 */
export async function createAnalysisJob({
  store,
  scheduler,
  prepareRequest,
  resolveIdentity,
  viewer,
  idempotencyKey,
  request,
}) {
  const prepared = await prepareRequest(request);
  const identity = await resolveIdentity(prepared);
  const result = store.create({
    viewer,
    idempotency_key: idempotencyKey,
    identity,
    request: prepared,
  });
  scheduler.kick();
  return result;
}

export function createReaderRouter({
  store,
  scheduler,
  secret,
  site,
  resolveIdentity,
  prepareRequest = async (request) => request,
}) {
  const router = express.Router();
  router.use('/internal/reader', createReaderAuthenticator({ secret, site }));
  const handler = (fn) => (req, res, next) =>
    Promise.resolve()
      .then(() => fn(req, res))
      .catch(next);
  const authorized = (req) => {
    const auth = req.readerAuth;
    if (auth.job !== req.params.id)
      throw fail('BAD_SIGNATURE', 'The signed job binding does not match.', 403);
    return store.get(req.params.id, auth.capability, auth.viewer);
  };
  const controlOptions = (req) => ({
    idempotency_key: req.readerAuth.idempotency,
    digest: req.readerAuth.digest,
    expected_attempt: req.readerAuth.attempt ? Number(req.readerAuth.attempt) : undefined,
    expected_generation: req.readerAuth.generation ? Number(req.readerAuth.generation) : undefined,
  });
  router.post(
    '/internal/reader/jobs',
    handler(async (req, res) => {
      if (req.readerAuth.job || req.readerAuth.capability)
        throw fail('BAD_SIGNATURE', 'Create must have an empty job binding.');
      let request = validateRequest(req.body);
      if (request.idempotency_key && request.idempotency_key !== req.readerAuth.idempotency)
        throw fail('IDEMPOTENCY_CONFLICT', 'The body and signed idempotency keys disagree.', 409);
      const result = await createAnalysisJob({
        store,
        scheduler,
        prepareRequest,
        resolveIdentity,
        viewer: req.readerAuth.viewer,
        idempotencyKey: req.readerAuth.idempotency,
        request,
      });
      res.status(result.created ? 202 : 200).json({
        contract_version: 1,
        job: publicReaderJob(result.record),
        capability: result.capability,
      });
    })
  );
  router.get(
    '/internal/reader/jobs/:id',
    handler((req, res) =>
      res.json({
        contract_version: 1,
        job: publicReaderJob(authorized(req)),
      })
    )
  );
  router.post(
    '/internal/reader/jobs/:id/resume',
    handler(async (req, res) => {
      const record = authorized(req);
      const identity = await resolveIdentity(record.request);
      const result = store.resume(
        record.id,
        req.readerAuth.capability,
        req.readerAuth.viewer,
        identity,
        controlOptions(req)
      );
      scheduler.kick();
      res.status(202).json({ contract_version: 1, job: publicReaderJob(result) });
    })
  );
  router.post(
    '/internal/reader/jobs/:id/cancel',
    handler((req, res) => {
      authorized(req);
      const result = store.cancel(
        req.params.id,
        req.readerAuth.capability,
        req.readerAuth.viewer,
        controlOptions(req)
      );
      res.json({ contract_version: 1, job: publicReaderJob(result) });
    })
  );
  router.delete(
    '/internal/reader/jobs/:id',
    handler((req, res) => {
      if (req.readerAuth.job !== req.params.id)
        throw fail('BAD_SIGNATURE', 'The signed job binding does not match.', 403);
      store.delete(
        req.params.id,
        req.readerAuth.capability,
        req.readerAuth.viewer,
        controlOptions(req)
      );
      res.json({ contract_version: 1, deleted: true, job_id: req.params.id });
    })
  );
  router.get(
    '/internal/reader/jobs/:id/manifests/:sha',
    handler((req, res) => {
      authorized(req);
      if (!/^[a-f0-9]{64}$/.test(req.params.sha))
        throw fail('BAD_REQUEST', 'A manifest hash is required.');
      const manifest = store.readManifest(
        req.params.id,
        req.readerAuth.capability,
        req.readerAuth.viewer,
        req.params.sha
      );
      const bytes = Buffer.from(JSON.stringify(manifest));
      if (sha256(bytes) !== req.params.sha)
        throw fail('STORAGE_CORRUPT', 'The immutable manifest hash does not match.', 503);
      res
        .set('Cache-Control', 'private, no-store')
        .set('X-Reader-SHA256', req.params.sha)
        .type('application/json')
        .send(bytes);
    })
  );
  router.get(
    '/internal/reader/jobs/:id/pages/:sha',
    handler((req, res) => {
      authorized(req);
      if (
        !/^[a-f0-9]{64}$/.test(req.params.sha) ||
        !/^[a-f0-9]{64}$/.test(req.query.manifest || '')
      )
        throw fail('BAD_REQUEST', 'Page reads require a page hash and fixed manifest hash.');
      const page = store.readPage(
        req.params.id,
        req.params.sha,
        req.readerAuth.capability,
        req.readerAuth.viewer,
        req.query.manifest
      );
      const bytes = Buffer.isBuffer(page) ? page : Buffer.from(JSON.stringify(page));
      if (sha256(bytes) !== req.params.sha)
        throw fail('STORAGE_CORRUPT', 'The immutable page hash does not match.', 503);
      res
        .set('Cache-Control', 'private, no-store')
        .set('X-Reader-SHA256', req.params.sha)
        .type('application/json')
        .send(bytes);
    })
  );
  router.get(
    '/internal/reader/jobs/:id/manifests/:sha/pages',
    handler((req, res) => {
      authorized(req);
      if (!/^[a-f0-9]{64}$/.test(req.params.sha))
        throw fail('BAD_REQUEST', 'A fixed manifest hash is required.');
      const offset = Number(req.query.offset || 0);
      const limit = Number(req.query.limit || 100);
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 250
      )
        throw fail(
          'BAD_REQUEST',
          'Manifest pagination needs a nonnegative offset and limit from 1 to 250.'
        );
      res.json(
        store.readManifestPage(
          req.params.id,
          req.readerAuth.capability,
          req.readerAuth.viewer,
          req.params.sha,
          { offset, limit }
        )
      );
    })
  );
  router.use('/internal/reader', (_req, _res, next) =>
    next(fail('NOT_FOUND', 'This reader route is not available.', 404))
  );
  router.use('/internal/reader', (error, _req, res, _next) =>
    res
      .status(error.status || (['RESOURCE_LIMIT', 'QUEUE_FULL'].includes(error.code) ? 429 : 400))
      .json({
        error: {
          code: error.code || 'READER_ERROR',
          message: error.message,
          remedy:
            error.code === 'RESOURCE_LIMIT'
              ? 'Free storage or retry after capacity is available.'
              : 'Check the request and retry explicitly.',
        },
      })
  );
  return router;
}
