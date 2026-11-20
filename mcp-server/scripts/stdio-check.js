import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function sendJson(response, value, status = 200) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function parseToolResult(result) {
  assert.equal(result.isError, undefined);
  const textBlock = result.content?.find((item) => item.type === "text");
  assert.ok(textBlock?.text, "Expected a text content block from the MCP tool.");
  return JSON.parse(textBlock.text);
}

test("MCP stdio client discovers and calls all five read-only ProofPath tools", async () => {
  const observedMethods = [];
  const api = createServer((request, response) => {
    observedMethods.push(request.method);
    const url = new URL(request.url || "/", "http://127.0.0.1");

    if (url.pathname === "/api/opportunities") {
      return sendJson(response, {
        items: [{
          id: "opp_ai",
          slug: "ai-opportunity",
          title: "AI Opportunity",
          organization: "Example Foundation",
          country: "Global",
          category: "scholarship",
          verificationStatus: "SUPPORTED",
          isPublished: true,
          privateField: "must not escape"
        }],
        total: 1,
        page: 1,
        totalPages: 1,
        facets: { countries: ["Global"] }
      });
    }

    if (url.pathname === "/api/opportunities/opp_ai") {
      return sendJson(response, {
        opportunity: {
          id: "opp_ai",
          slug: "ai-opportunity",
          title: "AI Opportunity",
          organization: "Example Foundation",
          category: "scholarship",
          verificationStatus: "SUPPORTED",
          trustProfile: { officialDomain: "example.org" },
          privateField: "must not escape"
        },
        verificationHistory: [{
          summary: "PRIVATE USER VERIFICATION REPORT",
          claims: [{ claim: "private claim" }],
          userId: "private-user-id"
        }]
      });
    }

    if (url.pathname === "/api/opportunities/compare") {
      return sendJson(response, {
        items: [{
          id: "opp_ai",
          title: "AI Opportunity",
          verificationStatus: "SUPPORTED",
          privateField: "must not escape"
        }]
      });
    }

    if (url.pathname === "/api/public/stats") {
      return sendJson(response, {
        verifiedOpportunities: 2,
        totalOpportunities: 4,
        verificationReports: 3,
        countriesCovered: 2,
        communityReports: 1,
        announcement: { privateDraft: "omit this field" }
      });
    }

    if (url.pathname === "/api/health") {
      return sendJson(response, {
        status: "ok",
        database: "connected",
        aiConfigured: true,
        secret: "never expose",
        timestamp: "2026-11-20T00:00:00.000Z"
      });
    }

    return sendJson(response, { error: "not found" }, 404);
  });

  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const address = api.address();
  const apiBaseUrl = `http://127.0.0.1:${address.port}`;

  const entryPath = fileURLToPath(new URL("../src/index.js", import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entryPath],
    env: { ...process.env, PROOFPATH_API_BASE_URL: apiBaseUrl }
  });
  const client = new Client({ name: "proofpath-mcp-integration-test", version: "1.0.0" });

  try {
    await client.connect(transport);

    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      "check_api_health",
      "compare_opportunities",
      "get_opportunity_details",
      "get_public_platform_stats",
      "search_opportunities"
    ]);

    const search = parseToolResult(await client.callTool({
      name: "search_opportunities",
      arguments: { query: "AI", category: "scholarship", limit: 5 }
    }));
    assert.equal(search.total, 1);
    assert.equal(search.items[0].title, "AI Opportunity");
    assert.equal(search.items[0].privateField, undefined);

    const detailResult = await client.callTool({
      name: "get_opportunity_details",
      arguments: { idOrSlug: "opp_ai" }
    });
    const detail = parseToolResult(detailResult);
    assert.equal(detail.opportunity.title, "AI Opportunity");
    assert.equal(detail.verificationHistoryCount, 1);
    assert.equal(detail.opportunity.privateField, undefined);
    assert.equal(JSON.stringify(detail).includes("PRIVATE USER VERIFICATION REPORT"), false);
    assert.equal(JSON.stringify(detail).includes("private-user-id"), false);

    const comparison = parseToolResult(await client.callTool({
      name: "compare_opportunities",
      arguments: { ids: ["opp_ai"] }
    }));
    assert.equal(comparison.items.length, 1);
    assert.equal(comparison.items[0].privateField, undefined);

    const stats = parseToolResult(await client.callTool({
      name: "get_public_platform_stats",
      arguments: {}
    }));
    assert.equal(stats.totalOpportunities, 4);
    assert.equal(stats.announcement, undefined);

    const health = parseToolResult(await client.callTool({
      name: "check_api_health",
      arguments: {}
    }));
    assert.equal(health.status, "ok");
    assert.equal(health.database, "connected");
    assert.equal(health.aiConfigured, undefined);
    assert.equal(health.secret, undefined);

    assert.deepEqual([...new Set(observedMethods)], ["GET"]);
    assert.equal(observedMethods.length, 5);
  } finally {
    await client.close().catch(() => {});
    await new Promise((resolve, reject) => {
      api.close((error) => error ? reject(error) : resolve());
    });
  }
});
