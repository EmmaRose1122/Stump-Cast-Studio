import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export class FetchBlockedError extends Error {}

/** True for loopback, private, link-local, CGNAT, multicast, cloud-metadata and mapped IPv4. */
export const isPrivateAddress = (ip: string): boolean => {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local + cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224 // multicast and reserved
    );
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === '::' || v === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return (
      v.startsWith('fc') || // unique local fc00::/7
      v.startsWith('fd') ||
      v.startsWith('fe8') || // link-local fe80::/10
      v.startsWith('fe9') ||
      v.startsWith('fea') ||
      v.startsWith('feb') ||
      v.startsWith('ff') // multicast
    );
  }
  return true; // not an IP at all: treat as unsafe
};

/** A `dns.lookup` replacement that refuses to hand back a private address (no DNS rebinding). */
const guardedLookup = ((
  hostname: string,
  options: dns.LookupOptions,
  cb: (err: Error | null, address: string | dns.LookupAddress[], family?: number) => void,
) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, '', 4);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad || list.length === 0) {
      return cb(new FetchBlockedError(`Blocked address for ${hostname}`), '', 4);
    }
    if (options.all) return cb(null, list);
    return cb(null, list[0]!.address, list[0]!.family);
  });
}) as unknown as typeof dns.lookup;

export interface FetchedImage {
  buffer: Buffer;
  contentType: string;
}

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

/**
 * Download an image from a user-supplied URL without letting it reach internal services:
 * http(s) only, no credentials in the URL, every connection address (including after
 * redirects) is checked, response size and type are limited.
 */
export const safeFetchImage = async (
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<FetchedImage> => {
  const maxBytes = opts.maxBytes ?? 8 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchBlockedError('That is not a valid URL');
  }

  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new FetchBlockedError('Only http and https links are allowed');
    }
    if (url.username || url.password)
      throw new FetchBlockedError('Credentials in a URL are not allowed');
    // A literal IP never goes through DNS, so check it here.
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && isPrivateAddress(host)) {
      throw new FetchBlockedError('That address is not allowed');
    }

    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.get(
        url,
        { lookup: guardedLookup, timeout: timeoutMs, headers: { 'user-agent': 'StumpCast/0.1' } },
        resolve,
      );
      req.on('timeout', () => req.destroy(new Error('The download timed out')));
      req.on('error', reject);
    });

    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      url = new URL(res.headers.location, url);
      continue;
    }
    if (status !== 200) {
      res.resume();
      throw new FetchBlockedError(`The server answered ${status}`);
    }
    const contentType = String(res.headers['content-type'] ?? '')
      .split(';')[0]!
      .trim()
      .toLowerCase();
    if (!contentType.startsWith('image/')) {
      res.resume();
      throw new FetchBlockedError('That link is not an image');
    }
    const declared = Number(res.headers['content-length'] ?? 0);
    if (declared > maxBytes) {
      res.resume();
      throw new FetchBlockedError('That image is too large');
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res) {
      size += (chunk as Buffer).length;
      if (size > maxBytes) {
        res.destroy();
        throw new FetchBlockedError('That image is too large');
      }
      chunks.push(chunk as Buffer);
    }
    return { buffer: Buffer.concat(chunks), contentType };
  }
  throw new FetchBlockedError('Too many redirects');
};
