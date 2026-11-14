import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / cloud metadata 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('::ffff:')) {
    const mappedV4 = lower.slice(7);
    if (net.isIPv4(mappedV4)) return isPrivateIPv4(mappedV4);
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
  if (lower.startsWith('fe80:')) return true; // link-local fe80::/10
  return false;
}

export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid URL format. Provide a full http:// or https:// URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are allowed.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs containing embedded credentials are not permitted.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    throw new Error('Access to internal, loopback, or local hostnames is blocked.');
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error('Access to private, loopback, or metadata IP ranges is blocked.');
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records.length) {
      throw new Error('Could not resolve target domain.');
    }
    for (const record of records) {
      if (isBlockedIp(record.address)) {
        throw new Error('Target domain resolves to a restricted private IP address.');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('restricted')) {
      throw err;
    }
    // Allow Gemini urlContext/googleSearch to handle domains if local DNS lookup is restricted in sandbox,
    // while still blocking explicit private IPs/hostnames above.
  }

  return parsed;
}

export async function fetchPublicUrlSnippet(safeUrl: URL): Promise<{
  reachable: boolean;
  statusCode: number | null;
  finalUrl: string;
  pageTitle: string;
  textExcerpt: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(safeUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ProofPathAI-Verifier/1.0 (+https://proofpath.ai)',
        Accept: 'text/html,application/xhtml+xml,text/plain',
      },
    });

    const finalParsed = await assertSafePublicUrl(response.url || safeUrl.toString());
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json')) {
      return {
        reachable: response.ok,
        statusCode: response.status,
        finalUrl: finalParsed.toString(),
        pageTitle: '',
        textExcerpt: `Non-HTML resource (${contentType})`,
      };
    }

    const html = (await response.text()).slice(0, 120000);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);

    return {
      reachable: response.ok,
      statusCode: response.status,
      finalUrl: finalParsed.toString(),
      pageTitle,
      textExcerpt: stripped,
    };
  } catch {
    return {
      reachable: false,
      statusCode: null,
      finalUrl: safeUrl.toString(),
      pageTitle: '',
      textExcerpt: '',
    };
  } finally {
    clearTimeout(timeout);
  }
}
