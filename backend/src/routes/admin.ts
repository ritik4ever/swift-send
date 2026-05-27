import type { FastifyInstance } from 'fastify';
import { requireVerifiedSession } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { getSession, saveSession } from '../auth/sessionStore';
import type { JwtSessionPayload } from '../auth/sessionTypes';

interface SetGateBody {
  open: boolean;
}

interface SetAllowBody {
  userId: string;
  allow: boolean;
}

interface SetRoleBody {
  userId: string;
  role: 'admin' | 'user';
}

interface DlqRetryBody {
  jobId: string;
}

export default async function adminRoutes(fastify: FastifyInstance) {
  const adminGuards = { preHandler: [requireVerifiedSession, requireRole('admin')] };

  fastify.get('/admin/fees/analytics', adminGuards, async () => {
    return fastify.container.services.activity.getAdminFeeAnalytics();
  });

  /** GET /admin/rbac/status — view current Access Guard state */
  fastify.get('/admin/rbac/status', adminGuards, async (req) => {
    return fastify.container.services.accessGuard.getStatus();
  });

  /** POST /admin/rbac/gate — open or close the system-wide transfer gate */
  fastify.post<{ Body: SetGateBody }>(
    '/admin/rbac/gate',
    adminGuards,
    async (req, reply) => {
      if (typeof req.body?.open !== 'boolean') {
        return reply.code(400).send({ error: '`open` (boolean) is required' });
      }
      const payload = req.user as JwtSessionPayload;
      fastify.container.services.accessGuard.setGate(req.body.open, payload.sub);
      return { gateOpen: req.body.open };
    },
  );

  /** POST /admin/rbac/allow — explicitly allow or block a user */
  fastify.post<{ Body: SetAllowBody }>(
    '/admin/rbac/allow',
    adminGuards,
    async (req, reply) => {
      const { userId, allow } = req.body ?? {};
      if (!userId || typeof allow !== 'boolean') {
        return reply.code(400).send({ error: '`userId` and `allow` (boolean) are required' });
      }
      const payload = req.user as JwtSessionPayload;
      fastify.container.services.accessGuard.setAllow(userId, allow, payload.sub);
      return { userId, allow };
    },
  );

  /** POST /admin/rbac/role — assign a role to a user */
  fastify.post<{ Body: SetRoleBody }>(
    '/admin/rbac/role',
    adminGuards,
    async (req, reply) => {
      const { userId, role } = req.body ?? {};
      if (!userId || !['admin', 'user'].includes(role)) {
        return reply.code(400).send({ error: '`userId` and `role` (admin|user) are required' });
      }
      const payload = req.user as JwtSessionPayload;
      fastify.container.services.accessGuard.setRole(userId, role, payload.sub);

      // Persist role into the session so it's reflected immediately
      const session = getSession(userId);
      if (session) {
        session.role = role;
        saveSession(session);
      }

      return { userId, role };
    },
  );

  /** Dead Letter Queue Management */

  /** GET /admin/dlq — view all DLQ entries */
  fastify.get('/admin/dlq', adminGuards, async () => {
    return fastify.container.services.deadLetterQueue.getAllEntries();
  });

  /** GET /admin/dlq/stats — DLQ statistics */
  fastify.get('/admin/dlq/stats', adminGuards, async () => {
    return fastify.container.services.deadLetterQueue.getStats();
  });

  /** GET /admin/dlq/:jobId — view single DLQ entry */
  fastify.get<{ Params: { jobId: string } }>(
    '/admin/dlq/:jobId',
    adminGuards,
    async (req, reply) => {
      const entry = fastify.container.services.deadLetterQueue.getEntry(req.params.jobId);
      if (!entry) {
        return reply.code(404).send({ error: 'DLQ entry not found' });
      }
      return entry;
    },
  );

  /** POST /admin/dlq/retry — retry a single DLQ entry */
  fastify.post<{ Body: DlqRetryBody }>(
    '/admin/dlq/retry',
    adminGuards,
    async (req, reply) => {
      const { jobId } = req.body ?? {};
      if (!jobId) {
        return reply.code(400).send({ error: '`jobId` is required' });
      }

      const transfers = fastify.container.services.transfers;
      const entry = await fastify.container.services.deadLetterQueue.retryJob(
        jobId,
        async (command) => transfers.createTransfer(command),
      );

      if (!entry) {
        return reply.code(404).send({ error: 'DLQ entry not found' });
      }

      return entry;
    },
  );

  /** POST /admin/dlq/retry-all — retry all pending DLQ entries */
  fastify.post('/admin/dlq/retry-all', adminGuards, async () => {
    const transfers = fastify.container.services.transfers;
    const result = await fastify.container.services.deadLetterQueue.retryAll(
      async (command) => transfers.createTransfer(command),
    );
    return result;
  });

  /** POST /admin/dlq/:jobId/discard — discard a DLQ entry */
  fastify.post<{ Params: { jobId: string } }>(
    '/admin/dlq/:jobId/discard',
    adminGuards,
    async (req, reply) => {
      const discarded = fastify.container.services.deadLetterQueue.discardEntry(req.params.jobId);
      if (!discarded) {
        return reply.code(404).send({ error: 'DLQ entry not found' });
      }
      return { discarded: true, jobId: req.params.jobId };
    },
  );

  /** POST /admin/dlq/purge — purge all discarded DLQ entries */
  fastify.post('/admin/dlq/purge', adminGuards, async () => {
    const purged = fastify.container.services.deadLetterQueue.purgeDiscarded();
    return { purged };
  });

  /** Settlement Analytics */

  /** GET /admin/settlements/analytics — settlement performance analytics */
  fastify.get('/admin/settlements/analytics', adminGuards, async (req)  => {
    const query = req.query as { days?: string };
    const days = Number(query.days) || 30;
    return fastify.container.services.settlementAnalytics.getAnalytics(days);
  });

  /** GET /admin/settlements/trend — settlement time trend */
  fastify.get('/admin/settlements/trend', adminGuards, async (req) => {
    const query = req.query as { days?: string; bucketDays?: string };
    const days = Number(query.days) || 30;
    const bucketDays = Number(query.bucketDays) || 1;
    return fastify.container.services.settlementAnalytics.getSettlementTimeTrend(days, bucketDays);
  });

  /** GET /admin/settlements/failed — failed transfers list */
  fastify.get('/admin/settlements/failed', adminGuards, async (req) => {
    const query = req.query as { days?: string; limit?: string };
    const days = Number(query.days) || 7;
    const limit = Number(query.limit) || 50;
    return fastify.container.services.settlementAnalytics.getFailedTransfers(days, limit);
  });

  /** Stellar Monitor */

  /** GET /admin/stellar/monitor — stellar monitor state */
  fastify.get('/admin/stellar/monitor', adminGuards, async () => {
    return fastify.container.services.stellarMonitor.getState();
  });

  /** Auth Risk Suspicious Activity */

  /** GET /admin/auth/suspicious — suspicious auth activity */
  fastify.get('/admin/auth/suspicious', adminGuards, async (req) => {
    const query = req.query as { limit?: string };
    const limit = Number(query.limit) || 50;
    return fastify.container.services.authRiskEngine.getSuspiciousActivity(limit);
  });
}
