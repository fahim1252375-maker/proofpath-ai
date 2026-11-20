import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import { pathToFileURL } from "node:url";

const SERVER_VERSION = "1.0.0";
const DEFAULT_API_BASE_URL = "https://proofpath-ai-demo.onrender.com";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_500_000;

const PUBLIC_OPPORTUNITY_FIELDS = [
  "id",
  "slug",
  "title",
  "organization",
  "country",
  "category",
  "educationLevel",
  "fundingType",
  "fundingAmount",
  "minGpa",
  "englishReq",
  "eligibleNationalities",
  "minAge",
  "maxAge",
  "deadline",
  "officialUrl",
  "description",
  "requirements",
  "verificationStatus",
  "lastVerifiedAt",
  "isPublished",
  "trustProfile"
];

const categorySchema = z.enum([
  "scholarship",
  "internship",
  "competition",
  "fellowship",
  "grant"
]);

const educationLevelSchema = z.enum([
  "high_school",
  "undergraduate",
  "masters",
  "phd",
  "all"
]);

const fundingTypeSchema = z.enum([
  "fully_funded",
  "partially_funded",
  "paid_stipend",
  "prize_pool",
  "unfunded"
]);

const verificationStatusSchema = z.enum([
  "VERIFIED",
  "SUPPORTED",
  "CONTRADICTED",
  "UNVERIFIED",
  "INSUFFICIENT_EVIDENCE",
  "EXPIRED"
]);

function resolveApiBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("PROOFPATH_API_BASE_URL must be a valid absolute HTTP(S) URL.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error("PROOFPATH_API_BASE_URL must not contain credentials, a query string, or a fragment.");
  }

  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error("Use HTTPS for remote APIs; plain HTTP is allowed only for a local loopback server.");
  }

  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("PROOFPATH_API_BASE_URL must point to the API origin, without a path.");
  }

  return url;
}

function projectPublicOpportunity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const projected = {};
  for (const field of PUBLIC_OPPORTUNITY_FIELDS) {
    if (Object.hasOwn(value, field)) projected[field] = value[field];
  }
  return projected;
}

function jsonResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function toolError(error) {
  const message = error instanceof Error ? error.message : "Unknown ProofPath API error.";
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}

async function requestJson(apiBaseUrl, route, fetchImpl) {
  const url = new URL(route, apiBaseUrl);
  let response;

  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "error"
    });
  } catch {
    throw new Error("Could not reach the ProofPath API. Check that the service is running and PROOFPATH_API_BASE_URL is correct.");
  }

  if (!response.ok) {
    if (response.status === 404) throw new Error("The requested ProofPath resource was not found.");
    throw new Error(`ProofPath API returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("ProofPath API returned an unexpected content type.");
  }

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("ProofPath API response exceeded the MCP server response limit.");
  }

  let body;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          await reader.cancel().catch(() => {});
          throw new Error("ProofPath API response exceeded the MCP server response limit.");
        }
        chunks.push(Buffer.from(value));
      }
      body = Buffer.concat(chunks).toString("utf8");
    } finally {
      reader.releaseLock();
    }
  } else {
    body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
      throw new Error("ProofPath API response exceeded the MCP server response limit.");
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("ProofPath API returned invalid JSON.");
  }
}

export function createProofPathMcpServer({
  apiBaseUrl = process.env.PROOFPATH_API_BASE_URL || DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  const baseUrl = resolveApiBaseUrl(apiBaseUrl);
  if (typeof fetchImpl !== "function") throw new Error("A Fetch-compatible implementation is required.");

  const server = new McpServer({
    name: "proofpath-ai-mcp-server",
    version: SERVER_VERSION
  });

  server.registerTool(
    "search_opportunities",
    {
      title: "Search published opportunities",
      description: "Search ProofPath AI's public catalogue of published scholarships, internships, fellowships, grants, and competitions. Returns public listing fields only.",
      inputSchema: {
        query: z.string().trim().max(120).optional(),
        category: categorySchema.optional(),
        country: z.string().trim().max(100).optional(),
        educationLevel: educationLevelSchema.optional(),
        fundingType: fundingTypeSchema.optional(),
        status: verificationStatusSchema.optional(),
        maxGpa: z.number().min(0).max(100).optional(),
        deadlineBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        sort: z.enum(["deadline_asc", "deadline_desc", "verified_recent", "title_asc"]).optional(),
        page: z.number().int().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(25).optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (args) => {
      try {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(args)) {
          if (value !== undefined && value !== null && value !== "") {
            params.set(key, String(value));
          }
        }
        const route = `/api/opportunities${params.size ? `?${params.toString()}` : ""}`;
        const payload = await requestJson(baseUrl, route, fetchImpl);
        const items = Array.isArray(payload.items)
          ? payload.items.map(projectPublicOpportunity).filter(Boolean)
          : [];
        return jsonResult({
          items,
          total: Number(payload.total || 0),
          page: Number(payload.page || 1),
          totalPages: Number(payload.totalPages || 1),
          countries: Array.isArray(payload.facets?.countries) ? payload.facets.countries : []
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "get_opportunity_details",
    {
      title: "Get public opportunity details",
      description: "Read one published opportunity by ID or slug. Returns an allowlisted public opportunity projection and a count of related verification reports, never the reports' private contents.",
      inputSchema: {
        idOrSlug: z.string().trim().min(1).max(160)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ idOrSlug }) => {
      try {
        const payload = await requestJson(
          baseUrl,
          `/api/opportunities/${encodeURIComponent(idOrSlug)}`,
          fetchImpl
        );
        return jsonResult({
          opportunity: projectPublicOpportunity(payload.opportunity),
          verificationHistoryCount: Array.isArray(payload.verificationHistory)
            ? payload.verificationHistory.length
            : 0
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "compare_opportunities",
    {
      title: "Compare published opportunities",
      description: "Compare between one and four published opportunities by ID using ProofPath's existing comparison route. Only public opportunity fields are returned.",
      inputSchema: {
        ids: z.array(z.string().trim().min(1).max(160)).min(1).max(4)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ ids }) => {
      try {
        const params = new URLSearchParams({ ids: ids.join(",") });
        const payload = await requestJson(
          baseUrl,
          `/api/opportunities/compare?${params.toString()}`,
          fetchImpl
        );
        const items = Array.isArray(payload.items)
          ? payload.items.map(projectPublicOpportunity).filter(Boolean)
          : [];
        return jsonResult({ items });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "get_public_platform_stats",
    {
      title: "Get public platform statistics",
      description: "Read aggregate public catalogue and platform counts. The landing-page announcement payload is intentionally omitted.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => {
      try {
        const payload = await requestJson(baseUrl, "/api/public/stats", fetchImpl);
        return jsonResult({
          verifiedOpportunities: Number(payload.verifiedOpportunities || 0),
          totalOpportunities: Number(payload.totalOpportunities || 0),
          verificationReports: Number(payload.verificationReports || 0),
          countriesCovered: Number(payload.countriesCovered || 0),
          communityReports: Number(payload.communityReports || 0)
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "check_api_health",
    {
      title: "Check ProofPath API health",
      description: "Check the public API and database health. Configuration flags and secrets are not returned.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => {
      try {
        const payload = await requestJson(baseUrl, "/api/health", fetchImpl);
        return jsonResult({
          status: payload.status || "unknown",
          database: payload.database || "unknown",
          timestamp: payload.timestamp || null
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  return server;
}

async function startStdioServer() {
  const server = createProofPathMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startStdioServer().catch((error) => {
    // MCP stdio reserves stdout for protocol messages. Diagnostics go to stderr.
    console.error("ProofPath MCP server failed to start:", error);
    process.exitCode = 1;
  });
}
