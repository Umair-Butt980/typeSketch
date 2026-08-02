import {
  cloud,
  cylinder,
  dashedRect,
  diamond,
  documentShape,
  doubleCylinder,
  drum,
  fan,
  hexagon,
  phone,
  queueBar,
  roundedRect,
  sharpRect,
  shield,
  stadium,
  stickFigure,
  windowFrame,
} from "./geometry";
import { FALLBACK_ARCHETYPE, type Archetype } from "./types";

const WIDE = { w: 150, h: 64 };
const BOX = { w: 140, h: 62 };

/**
 * The v1 vocabulary. Aliases are matched against the whole normalised label
 * first, then against its trailing and leading dash-segments — see `resolver`.
 *
 * Every alias must be unique across the whole table: a word that resolved to
 * two archetypes would make the diagram depend on iteration order, which is
 * precisely the non-determinism the registry-only design exists to avoid.
 * There is a test for it.
 */
export const ARCHETYPES: readonly Archetype[] = [
  {
    name: "actor",
    aliases: ["user", "users", "customer", "client", "person", "admin", "actor", "visitor", "employee"],
    defaultSize: { w: 52, h: 76 },
    labelSlot: "below",
    geometry: stickFigure,
  },
  {
    name: "service",
    aliases: ["api", "service", "backend", "server", "microservice", "endpoint", "app"],
    defaultSize: WIDE,
    labelSlot: "inside",
    geometry: roundedRect,
  },
  {
    name: "database",
    aliases: ["db", "database", "postgres", "postgresql", "mysql", "rds", "sql", "sqlite", "mariadb", "datastore"],
    defaultSize: { w: 130, h: 86 },
    labelSlot: "inside",
    geometry: cylinder,
  },
  {
    name: "cache",
    aliases: ["cache", "redis", "memcached", "elasticache"],
    defaultSize: { w: 124, h: 86 },
    labelSlot: "inside",
    geometry: doubleCylinder,
  },
  {
    name: "queue",
    aliases: ["queue", "kafka", "sqs", "rabbitmq", "pubsub", "topic", "broker", "stream", "events"],
    defaultSize: { w: 152, h: 54 },
    labelSlot: "inside",
    geometry: queueBar,
  },
  {
    name: "storage",
    aliases: ["storage", "s3", "bucket", "blob", "disk", "store", "volume", "filestore"],
    defaultSize: { w: 130, h: 74 },
    labelSlot: "inside",
    geometry: drum,
  },
  {
    name: "function",
    aliases: ["lambda", "function", "fn", "worker", "job", "task", "handler"],
    defaultSize: WIDE,
    labelSlot: "inside",
    geometry: hexagon,
  },
  {
    name: "browser",
    aliases: ["browser", "web", "frontend", "spa", "ui", "page", "website", "portal"],
    defaultSize: { w: 152, h: 92 },
    labelSlot: "inside",
    geometry: windowFrame,
  },
  {
    name: "mobile",
    aliases: ["mobile", "ios", "android", "phone", "device"],
    defaultSize: { w: 86, h: 124 },
    labelSlot: "inside",
    geometry: phone,
  },
  {
    name: "external",
    aliases: ["external", "third-party", "vendor", "saas", "partner", "integration"],
    defaultSize: WIDE,
    labelSlot: "inside",
    geometry: dashedRect,
  },
  {
    name: "cdn",
    aliases: ["cdn", "edge", "cloudfront"],
    defaultSize: { w: 132, h: 74 },
    labelSlot: "inside",
    geometry: cloud,
  },
  {
    name: "cloud",
    aliases: ["cloud", "aws", "gcp", "azure", "datacenter"],
    defaultSize: { w: 132, h: 74 },
    labelSlot: "inside",
    geometry: cloud,
  },
  {
    name: "balancer",
    aliases: ["lb", "loadbalancer", "load-balancer", "alb", "nlb", "proxy", "nginx", "ingress", "gateway", "router"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: fan,
  },
  {
    name: "auth",
    aliases: ["auth", "authentication", "oauth", "idp", "sso", "identity", "keycloak"],
    defaultSize: { w: 124, h: 84 },
    labelSlot: "inside",
    geometry: shield,
  },
  {
    name: "firewall",
    aliases: ["firewall", "waf", "security"],
    defaultSize: { w: 124, h: 84 },
    labelSlot: "inside",
    geometry: shield,
  },
  {
    name: "search",
    aliases: ["search", "elasticsearch", "opensearch", "solr", "algolia", "index"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: roundedRect,
  },
  {
    name: "analytics",
    aliases: ["analytics", "metrics", "telemetry", "tracking", "dashboard"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: roundedRect,
  },
  {
    name: "monitoring",
    aliases: ["monitoring", "prometheus", "grafana", "alerting", "observability", "alerts"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: roundedRect,
  },
  {
    name: "mail",
    aliases: ["mail", "email", "smtp", "sendgrid", "ses", "notifications", "notification"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: roundedRect,
  },
  {
    name: "payment",
    aliases: ["payment", "payments", "stripe", "billing", "checkout"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: roundedRect,
  },
  {
    name: "container",
    aliases: ["container", "docker", "pod", "k8s", "kubernetes", "cluster"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: sharpRect,
  },
  {
    name: "logs",
    aliases: ["logs", "logging", "elk", "splunk", "datadog", "audit"],
    defaultSize: { w: 132, h: 82 },
    labelSlot: "inside",
    geometry: documentShape,
  },
  {
    name: "document",
    aliases: ["document", "file", "doc", "report", "pdf", "spec"],
    defaultSize: { w: 132, h: 82 },
    labelSlot: "inside",
    geometry: documentShape,
  },
  {
    name: "config",
    aliases: ["config", "settings", "env", "secrets", "vault", "parameters"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: roundedRect,
  },
  {
    name: "scheduler",
    aliases: ["scheduler", "cron", "timer", "schedule", "cronjob"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: hexagon,
  },
  {
    name: "decision",
    aliases: ["decision", "branch", "condition", "check", "choice"],
    defaultSize: { w: 128, h: 84 },
    labelSlot: "inside",
    geometry: diamond,
  },
  {
    name: "terminal",
    aliases: ["start", "end", "terminal", "done", "finish"],
    defaultSize: { w: 124, h: 54 },
    labelSlot: "inside",
    geometry: stadium,
  },
  {
    name: "process",
    aliases: ["process", "step", "action", "operation"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: sharpRect,
  },
  {
    name: "note",
    aliases: ["note", "comment", "annotation", "memo"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: dashedRect,
  },
  {
    // The fallback. Unknown vocabulary lands here rather than erroring.
    name: FALLBACK_ARCHETYPE,
    aliases: ["box", "node", "component", "thing", "system"],
    defaultSize: BOX,
    labelSlot: "inside",
    geometry: sharpRect,
  },
];

export const FALLBACK: Archetype = ARCHETYPES.find(
  (a) => a.name === FALLBACK_ARCHETYPE,
)!;
