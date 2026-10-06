import dns from "node:dns/promises";
import net from "node:net";

const allowedProtocols = new Set(["http:", "https:"]);
const allowedPorts = new Set(["", "80", "443"]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function normalizeUrl(input: string): URL {
  const value = input.trim();
  if (!value) throw new UnsafeUrlError("Enter a website URL.");
  const hasProtocol = /^[a-z][a-z\d+.-]*:/i.test(value);
  const url = new URL(hasProtocol ? value : `https://${value}`);
  if (!allowedProtocols.has(url.protocol)) throw new UnsafeUrlError("Only HTTP and HTTPS URLs can be scanned.");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with embedded credentials cannot be scanned.");
  if (!allowedPorts.has(url.port)) throw new UnsafeUrlError("Only standard HTTP and HTTPS ports can be scanned.");
  if (!url.hostname) throw new UnsafeUrlError("Enter a valid website URL.");
  return url;
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 224) || first >= 240;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff");
}

export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertSafeUrl(input: string): Promise<URL> {
  const url = normalizeUrl(input);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new UnsafeUrlError("Local and internal addresses cannot be scanned.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new UnsafeUrlError("Private and local network addresses cannot be scanned.");
    return url;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("The website address could not be resolved.");
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new UnsafeUrlError("The website resolves to a private or local network address.");
  }
  return url;
}
