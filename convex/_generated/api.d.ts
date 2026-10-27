/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as campaigns from "../campaigns.js";
import type * as counters from "../counters.js";
import type * as crons from "../crons.js";
import type * as emails_events from "../emails/events.js";
import type * as emails_send from "../emails/send.js";
import type * as emails_templates from "../emails/templates.js";
import type * as emails_testerTemplates from "../emails/testerTemplates.js";
import type * as http from "../http.js";
import type * as rateLimits from "../rateLimits.js";
import type * as sync from "../sync.js";
import type * as testers from "../testers.js";
import type * as unsubscribe from "../unsubscribe.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  analytics: typeof analytics;
  auth: typeof auth;
  campaigns: typeof campaigns;
  counters: typeof counters;
  crons: typeof crons;
  "emails/events": typeof emails_events;
  "emails/send": typeof emails_send;
  "emails/templates": typeof emails_templates;
  "emails/testerTemplates": typeof emails_testerTemplates;
  http: typeof http;
  rateLimits: typeof rateLimits;
  sync: typeof sync;
  testers: typeof testers;
  unsubscribe: typeof unsubscribe;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
