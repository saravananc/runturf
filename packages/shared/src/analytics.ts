/** First-party product-analytics contract, shared by the clients and the API. */

/**
 * The closed set of events the app records. Keep this list small and
 * intentional: each name should answer a question someone actually has, not
 * open a firehose. The union is exported so call sites can't invent names and
 * the API can validate against exactly this set.
 */
export const ANALYTICS_EVENTS = [
  'app_opened',
  'user_registered',
  'user_signed_in',
  'run_submitted',
  'territory_captured',
  'shop_item_purchased',
  'challenge_joined',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Which client surface emitted the event. */
export type AnalyticsSource = 'web' | 'mobile' | 'api';

/** Scalar-only context bag — kept flat so it maps cleanly to a JSON column. */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

/** A single tracked event as sent by a client. */
export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props?: AnalyticsProps;
  /**
   * Client clock (ms since epoch) when the event happened. Optional; the server
   * always stamps its own receipt time too, which is the trustworthy one.
   */
  ts?: number;
}

/** Request body for `POST /events` — a batch, so clients can buffer and flush. */
export interface AnalyticsBatch {
  /** The emitting surface. The server records it as-is; it does not affect auth. */
  source: AnalyticsSource;
  events: AnalyticsEvent[];
}
