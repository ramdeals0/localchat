import { describe, expect, it } from "vitest";
import { decryptBuffer, encryptBuffer, isEncryptedBackup } from "../src/export/encryption.js";

describe("backup encryption", () => {
  it("encrypts and decrypts buffers with a passphrase", () => {
    const original = Buffer.from("local-only backup payload");
    const encrypted = encryptBuffer(original, "test-passphrase");
    expect(isEncryptedBackup(encrypted)).toBe(true);
    const decrypted = decryptBuffer(encrypted, "test-passphrase");
    expect(decrypted.toString("utf8")).toBe(original.toString("utf8"));
  });

  it("rejects wrong passphrase", () => {
    const encrypted = encryptBuffer(Buffer.from("secret"), "right-pass");
    expect(() => decryptBuffer(encrypted, "wrong-pass")).toThrow();
  });
});
