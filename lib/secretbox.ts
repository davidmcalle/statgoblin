import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// At-rest encryption for stored secrets (currently the Discord webhook URL).
// AES-256-GCM with a key from the ENCRYPTION_KEY env var (64 hex chars —
// generate with `openssl rand -hex 32`). Stored shape: v1:<iv>:<tag>:<ct>,
// all base64, so a future key/scheme rotation can bump the prefix.

function key(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY must be set to 64 hex characters (openssl rand -hex 32)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptionConfigured(): boolean {
  const hex = process.env.ENCRYPTION_KEY;
  return !!hex && /^[0-9a-fA-F]{64}$/.test(hex);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, ct] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !ct) {
    throw new Error("unrecognized secret format");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString(
    "utf8",
  );
}
