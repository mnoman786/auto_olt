const SECRET = process.env.NEXT_PUBLIC_HMAC_SECRET ?? '';

function hexToBytes(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer as ArrayBuffer;
}

export async function verifyResponseHMAC(
  timestamp: string,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  if (!SECRET || !timestamp || !signature) return true; // not configured — skip
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const message = enc.encode(`${timestamp}:${rawBody}`);
    const sigBytes = hexToBytes(signature.replace('sha256=', ''));
    return crypto.subtle.verify('HMAC', key, sigBytes, message);
  } catch {
    return false;
  }
}
