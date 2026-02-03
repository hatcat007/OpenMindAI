/**
 * Privacy Filter Unit Tests
 *
 * Comprehensive tests for secret detection, file exclusion, and bash command sanitization.
 *
 * @module privacy/filter.test
 */

import { describe, it, expect } from "bun:test";
import {
  sanitizeContent,
  shouldCaptureFile,
  sanitizeBashCommand,
  isSensitiveContent,
  sanitizeObject,
  getExclusionReasons,
  REDACTED_COMMAND_STRING,
} from "./filter.js";

describe("sanitizeContent", () => {
  it("redacts password: value", () => {
    const input = "password: secret123";
    const result = sanitizeContent(input);
    expect(result).toBe("password: [REDACTED]");
  });

  it("redacts password= value", () => {
    const input = "password= secret123";
    const result = sanitizeContent(input);
    expect(result).toBe("password=[REDACTED]");
  });

  it("redacts api_key=value", () => {
    const input = "api_key=sk-abc123";
    const result = sanitizeContent(input);
    expect(result).toBe("api_key=[REDACTED]");
  });

  it("redacts api-key: value", () => {
    const input = "api-key: sk-xyz789";
    const result = sanitizeContent(input);
    expect(result).toBe("api-key: [REDACTED]");
  });

  it("redacts token: value", () => {
    const input = "token: bearer_123";
    const result = sanitizeContent(input);
    expect(result).toBe("token: [REDACTED]");
  });

  it("redacts secret= value", () => {
    const input = "secret= hidden_value";
    const result = sanitizeContent(input);
    expect(result).toBe("secret=[REDACTED]");
  });

  it("redacts private_key: value", () => {
    const input = "private_key: my_secret_key_value";
    const result = sanitizeContent(input);
    expect(result).toBe("private_key: [REDACTED]");
  });

  it("redacts BEGIN RSA PRIVATE KEY header", () => {
    const input = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQE...";
    const result = sanitizeContent(input);
    expect(result).toBe("[REDACTED]\nMIIEpAIBAAKCAQE...");
  });

  it("redacts BEGIN EC PRIVATE KEY header", () => {
    const input = "-----BEGIN EC PRIVATE KEY-----";
    const result = sanitizeContent(input);
    expect(result).toBe("[REDACTED]");
  });

  it("redacts multiple secrets in same content", () => {
    const input = "password: secret1 and api_key= secret2";
    const result = sanitizeContent(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("secret1");
    expect(result).not.toContain("secret2");
  });

  it("redacts credentials in URLs", () => {
    const input = "https://user:pass123@example.com/api";
    const result = sanitizeContent(input);
    expect(result).toBe("https://[REDACTED]@example.com/api");
  });

  it("preserves safe content", () => {
    const input = "hello world, this is normal text";
    const result = sanitizeContent(input);
    expect(result).toBe(input);
  });

  it("handles empty string", () => {
    const result = sanitizeContent("");
    expect(result).toBe("");
  });

  it("handles null/undefined gracefully", () => {
    expect(sanitizeContent(null as unknown as string)).toBe("");
    expect(sanitizeContent(undefined as unknown as string)).toBe("");
  });

  it("redacts mixed case secrets", () => {
    const input = "PASSWORD: Secret123";
    const result = sanitizeContent(input);
    expect(result).toBe("PASSWORD: [REDACTED]");
  });

  it("redacts db_password= format", () => {
    const input = 'db_password="my_secret_pass"';
    const result = sanitizeContent(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("my_secret_pass");
  });

  it("redacts access_token format", () => {
    const input = "access_token=eyJhbGciOiJIUzI1NiIs";
    const result = sanitizeContent(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiIs");
  });
});

describe("shouldCaptureFile", () => {
  it("excludes .env file", () => {
    expect(shouldCaptureFile(".env")).toBe(false);
  });

  it("excludes .env.local", () => {
    expect(shouldCaptureFile(".env.local")).toBe(false);
  });

  it("excludes .env.production", () => {
    expect(shouldCaptureFile(".env.production")).toBe(false);
  });

  it("excludes .env.development.local", () => {
    expect(shouldCaptureFile(".env.development.local")).toBe(false);
  });

  it("excludes .git directory files", () => {
    expect(shouldCaptureFile(".git/config")).toBe(false);
    expect(shouldCaptureFile(".git/hooks/pre-commit")).toBe(false);
  });

  it("excludes .key files", () => {
    expect(shouldCaptureFile("id_rsa.key")).toBe(false);
    expect(shouldCaptureFile("server.key")).toBe(false);
  });

  it("excludes .pem files", () => {
    expect(shouldCaptureFile("cert.pem")).toBe(false);
    expect(shouldCaptureFile("ca-bundle.pem")).toBe(false);
  });

  it("excludes .p12 files", () => {
    expect(shouldCaptureFile("certificate.p12")).toBe(false);
  });

  it("excludes .pfx files", () => {
    expect(shouldCaptureFile("keystore.pfx")).toBe(false);
  });

  it("excludes secret files", () => {
    expect(shouldCaptureFile("config/secrets.json")).toBe(false);
    expect(shouldCaptureFile("my_secrets.txt")).toBe(false);
  });

  it("excludes password files", () => {
    expect(shouldCaptureFile("passwords.txt")).toBe(false);
    expect(shouldCaptureFile("user_passwords.json")).toBe(false);
  });

  it("excludes credential files", () => {
    expect(shouldCaptureFile("credentials.yml")).toBe(false);
  });

  it("excludes token files", () => {
    expect(shouldCaptureFile("tokens.txt")).toBe(false);
    expect(shouldCaptureFile("api_tokens.json")).toBe(false);
  });

  it("excludes private files", () => {
    expect(shouldCaptureFile("private.key")).toBe(false);
    expect(shouldCaptureFile("private_config.yml")).toBe(false);
  });

  it("allows regular source files", () => {
    expect(shouldCaptureFile("src/index.ts")).toBe(true);
    expect(shouldCaptureFile("lib/utils.js")).toBe(true);
  });

  it("allows regular config files", () => {
    expect(shouldCaptureFile("package.json")).toBe(true);
    expect(shouldCaptureFile("tsconfig.json")).toBe(true);
    expect(shouldCaptureFile("README.md")).toBe(true);
  });

  it("handles Windows paths", () => {
    expect(shouldCaptureFile("C:\\project\\.env")).toBe(false);
    expect(shouldCaptureFile("C:\\project\\src\\index.ts")).toBe(true);
  });

  it("handles nested paths", () => {
    expect(shouldCaptureFile("/home/user/project/.env")).toBe(false);
    expect(shouldCaptureFile("/home/user/project/src/main.ts")).toBe(true);
  });

  it("rejects invalid paths", () => {
    expect(shouldCaptureFile("")).toBe(false);
    expect(shouldCaptureFile(null as unknown as string)).toBe(false);
    expect(shouldCaptureFile(undefined as unknown as string)).toBe(false);
  });
});

describe("sanitizeBashCommand", () => {
  it("redacts curl command with -u flag", () => {
    const input = "curl -u user:pass https://api.example.com";
    const result = sanitizeBashCommand(input);
    expect(result).toBe(REDACTED_COMMAND_STRING);
  });

  it("redacts curl command with --user flag", () => {
    const input = "curl --user admin:secret https://api.example.com";
    const result = sanitizeBashCommand(input);
    expect(result).toBe(REDACTED_COMMAND_STRING);
  });

  it("redacts ssh command with -p password", () => {
    const input = "ssh user@host -p password123";
    const result = sanitizeBashCommand(input);
    expect(result).toBe(REDACTED_COMMAND_STRING);
  });

  it("redacts mysql command with -p flag", () => {
    const input = "mysql -u root -p secret";
    const result = sanitizeBashCommand(input);
    expect(result).toBe(REDACTED_COMMAND_STRING);
  });

  it("redacts mysql command with --password", () => {
    const input = "mysql --user=root --password=secret";
    const result = sanitizeBashCommand(input);
    expect(result).toBe(REDACTED_COMMAND_STRING);
  });

  it("redacts psql command with -W flag", () => {
    const input = "psql -U postgres -W secret";
    const result = sanitizeBashCommand(input);
    expect(result).toBe(REDACTED_COMMAND_STRING);
  });

  it("redacts command containing password in arguments", () => {
    const input = 'echo "password: secret123"';
    const result = sanitizeBashCommand(input);
    expect(result).toBe(REDACTED_COMMAND_STRING);
  });

  it("allows safe ls command", () => {
    const input = "ls -la";
    const result = sanitizeBashCommand(input);
    expect(result).toBe("ls -la");
  });

  it("allows safe cat command", () => {
    const input = "cat file.txt";
    const result = sanitizeBashCommand(input);
    expect(result).toBe("cat file.txt");
  });

  it("allows safe grep command", () => {
    const input = "grep -r 'pattern' ./src";
    const result = sanitizeBashCommand(input);
    expect(result).toBe("grep -r 'pattern' ./src");
  });

  it("allows safe cd command", () => {
    const input = "cd /home/user/project";
    const result = sanitizeBashCommand(input);
    expect(result).toBe("cd /home/user/project");
  });

  it("allows safe mkdir command", () => {
    const input = "mkdir -p src/components";
    const result = sanitizeBashCommand(input);
    expect(result).toBe("mkdir -p src/components");
  });

  it("returns null for empty command", () => {
    expect(sanitizeBashCommand("")).toBe(null);
  });

  it("returns null for whitespace-only command", () => {
    expect(sanitizeBashCommand("   ")).toBe(null);
  });

  it("returns null for null/undefined input", () => {
    expect(sanitizeBashCommand(null as unknown as string)).toBe(null);
    expect(sanitizeBashCommand(undefined as unknown as string)).toBe(null);
  });

  it("trims whitespace from safe commands", () => {
    const input = "  ls -la  ";
    const result = sanitizeBashCommand(input);
    expect(result).toBe("ls -la");
  });
});

describe("isSensitiveContent", () => {
  it("detects password in content", () => {
    expect(isSensitiveContent("password: secret")).toBe(true);
  });

  it("detects api key in content", () => {
    expect(isSensitiveContent("api_key=xyz")).toBe(true);
  });

  it("returns false for safe content", () => {
    expect(isSensitiveContent("hello world")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSensitiveContent("")).toBe(false);
  });

  it("handles null/undefined gracefully", () => {
    expect(isSensitiveContent(null as unknown as string)).toBe(false);
    expect(isSensitiveContent(undefined as unknown as string)).toBe(false);
  });
});

describe("sanitizeObject", () => {
  it("sanitizes string values in object", () => {
    const input = { key: "password: secret" };
    const result = sanitizeObject(input);
    expect(result.key).toContain("[REDACTED]");
    expect(result.key).not.toContain("secret");
  });

  it("redacts sensitive keys entirely", () => {
    const input = { password: "mysecret", apiKey: "xyz123" };
    const result = sanitizeObject(input);
    expect(result.password).toBe("[REDACTED]");
    expect(result.apiKey).toBe("[REDACTED]");
  });

  it("preserves non-sensitive keys", () => {
    const input = { name: "John", age: 30 };
    const result = sanitizeObject(input);
    expect(result).toEqual(input);
  });

  it("sanitizes nested objects", () => {
    const input = { user: { password: "secret", name: "John" } };
    const result = sanitizeObject(input);
    expect(result.user.password).toBe("[REDACTED]");
    expect(result.user.name).toBe("John");
  });

  it("sanitizes arrays", () => {
    const input = ["password: secret", "safe text"];
    const result = sanitizeObject(input);
    expect(result[0]).toContain("[REDACTED]");
    expect(result[1]).toBe("safe text");
  });

  it("sanitizes arrays of objects", () => {
    const input = [{ password: "secret1" }, { password: "secret2" }] as Array<{password: string}>;
    const result = sanitizeObject(input);
    expect(result[0]!.password).toBe("[REDACTED]");
    expect(result[1]!.password).toBe("[REDACTED]");
  });

  it("handles null values", () => {
    const input = { value: null };
    const result = sanitizeObject(input);
    expect(result.value).toBe(null);
  });

  it("handles numbers", () => {
    const input = { count: 42 };
    const result = sanitizeObject(input);
    expect(result.count).toBe(42);
  });

  it("handles booleans", () => {
    const input = { enabled: true };
    const result = sanitizeObject(input);
    expect(result.enabled).toBe(true);
  });
});

describe("getExclusionReasons", () => {
  it("returns reason for .env file", () => {
    const reasons = getExclusionReasons(".env");
    expect(reasons).toContain(".env file");
  });

  it("returns reason for .env.local file", () => {
    const reasons = getExclusionReasons(".env.local");
    expect(reasons).toContain(".env variant file");
  });

  it("returns reason for secret file", () => {
    const reasons = getExclusionReasons("config/secrets.json");
    expect(reasons).toContain("Path contains 'secret'");
  });

  it("returns reason for git directory file", () => {
    const reasons = getExclusionReasons(".git/config");
    expect(reasons).toContain("Git directory file");
  });

  it("returns reason for key file", () => {
    const reasons = getExclusionReasons("server.pem");
    expect(reasons).toContain("Certificate/key file");
  });

  it("returns empty array for safe file", () => {
    const reasons = getExclusionReasons("src/index.ts");
    expect(reasons).toEqual([]);
  });

  it("returns invalid reason for empty path", () => {
    const reasons = getExclusionReasons("");
    expect(reasons).toContain("Invalid path");
  });

  it("returns multiple reasons for highly sensitive file", () => {
    const reasons = getExclusionReasons("/secrets/passwords.env");
    expect(reasons.length).toBeGreaterThan(1);
  });
});
