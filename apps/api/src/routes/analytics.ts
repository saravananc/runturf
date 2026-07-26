import { ANALYTICS_EVENTS, type AnalyticsEventName } from '@runturf/shared';
import { Router } from 'express';
import { z } from 'zod';
import { h, optionalAuth } from '../middleware.js';
import { recordEvents } from '../services/analytics.js';

const EventSchema = z.object({
  name: z.enum(ANALYTICS_EVENTS as unknown as [AnalyticsEventName, ...AnalyticsEventName[]]),
  props: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  ts: z.number().int().positive().optional(),
});

const BatchSchema = z.object({
  source: z.enum(['web', 'mobile']),
  // Bounded so a client can't post an unbounded payload in one request.
  events: z.array(EventSchema).min(1).max(50),
});

export const eventsRouter = Router();

// Optional auth: pre-login events (app_opened) are valid, but when a bearer
// token is present we attribute the batch to that user — server-side, not from
// the body.
eventsRouter.post(
  '/',
  optionalAuth,
  h(async (req, res) => {
    const { source, events } = BatchSchema.parse(req.body);
    const userId = (req.userId as string | undefined) ?? null;
    const recorded = await recordEvents(userId, source, events);
    res.status(202).json({ recorded });
  }),
);
