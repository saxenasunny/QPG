import crypto from 'crypto';

function key() {
  const hex = process.env.PAPER_ENC_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('PAPER_ENC_KEY must be 64 hex characters (openssl rand -hex 32)');
  return Buffer.from(hex, 'hex');
}

export function encryptJSON(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

export function decryptJSON(b64) {
  const buf = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
}

export const newPaperRef = () => 'QP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
