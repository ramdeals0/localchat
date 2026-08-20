import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export function encryptBuffer(data: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = scryptSync(passphrase, salt, KEY_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("LCENC1"), salt, iv, tag, encrypted]);
}

export function decryptBuffer(payload: Buffer, passphrase: string): Buffer {
  const marker = payload.subarray(0, 6).toString("utf8");
  if (marker !== "LCENC1") {
    throw new Error("Invalid encrypted backup format");
  }
  const salt = payload.subarray(6, 6 + SALT_LENGTH);
  const iv = payload.subarray(6 + SALT_LENGTH, 6 + SALT_LENGTH + IV_LENGTH);
  const tag = payload.subarray(
    6 + SALT_LENGTH + IV_LENGTH,
    6 + SALT_LENGTH + IV_LENGTH + 16,
  );
  const encrypted = payload.subarray(6 + SALT_LENGTH + IV_LENGTH + 16);
  const key = scryptSync(passphrase, salt, KEY_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function isEncryptedBackup(payload: Buffer): boolean {
  return payload.length >= 6 && payload.subarray(0, 6).toString("utf8") === "LCENC1";
}
