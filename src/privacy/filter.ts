/**
 * Privacy Filter Module
 *
 * Prevents sensitive data from being stored in mind.mv2.
 * Handles secret detection, file exclusion, and bash command sanitization.
 *
 * @module privacy/filter
 */

/**
 * Patterns for detecting sensitive content in strings.
 * These patterns match common secret formats like passwords, API keys, tokens, etc.
 *
 * NOTE: These patterns intentionally do NOT use the global (g) flag.
 * The global flag causes regex state issues where lastIndex persists across calls,
 * potentially causing subsequent .test() calls to miss matches at the start of strings.
 * This is a security-critical design choice to ensure consistent detection.
 */
export const SENSITIVE_PATTERNS: RegExp[] = [
  // Password patterns
  /password\s*[:=]\s*\S+/i,
  /[a-zA-Z0-9_]*password[a-zA-Z0-9_]*\s*[=:]\s*["']?[^"'\s]+["']?/i,

  // API key patterns
  /api[_-]?key\s*[:=]\s*\S+/i,

  // Token patterns
  /token\s*[:=]\s*\S+/i,

  // Secret patterns
  /secret\s*[:=]\s*\S+/i,

  // Private key patterns
  /private[_-]?key\s*[:=]\s*\S+/i,
  /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/,

  // URL with embedded credentials
  /:\/\/[^\s:@]+:[^\s:@]+@/,
];

/**
 * Patterns for excluding files from capture based on path.
 * These patterns match paths that should never be stored.
 */
export const EXCLUDED_PATH_PATTERNS: RegExp[] = [
  // .env files and variations (.env.local, .env.development.local, etc.)
  // Matches .env at root or in any directory
  /(^|\/)\.env$/,
  /(^|\/)\.env\.[\w.-]+$/,
  
  // Git directory
  /\.git\//,
  
  // Certificate and key files
  /\.(key|pem|p12|pfx)$/i,
  
  // Files with sensitive names in path
  /secret/i,
  /password/i,
  /credential/i,
  /token/i,
  /private/i,
];

/**
 * Patterns for detecting sensitive bash commands that should be redacted.
 */
export const SENSITIVE_BASH_PATTERNS: RegExp[] = [
  // curl with user credentials
  /curl.*-u\s/,
  /curl.*--user\s/,
  
  // ssh with password
  /ssh.*-p\s/,
  
  // mysql with password
  /mysql.*-p\s/,
  /mysql.*--password/,
  
  // postgres with password
  /psql.*-W\s/,
  /psql.*--password/,
];

/**
 * Replacement string for redacted sensitive content.
 */
export const REDACTED_STRING = "[REDACTED]";

/**
 * Replacement string for redacted bash commands.
 */
export const REDACTED_COMMAND_STRING = "[REDACTED BASH COMMAND]";

/**
 * Sanitizes content by redacting sensitive patterns.
 *
 * @param content - The content to sanitize
 * @returns Sanitized content with sensitive data replaced by [REDACTED]
 */
export function sanitizeContent(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  let sanitized = content;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      // For patterns that include the key name (like "password: "), preserve the key
      const colonIndex = match.indexOf(":");
      const equalsIndex = match.indexOf("=");
      
      if (colonIndex > 0 && (equalsIndex === -1 || colonIndex < equalsIndex)) {
        return match.substring(0, colonIndex + 1) + " " + REDACTED_STRING;
      }
      
      if (equalsIndex > 0 && (colonIndex === -1 || equalsIndex < colonIndex)) {
        return match.substring(0, equalsIndex + 1) + REDACTED_STRING;
      }
      
      // For URL patterns, replace the credentials portion
      if (match.includes("://")) {
        return match.replace(/:\/\/[^:]+:[^@]+@/, "://" + REDACTED_STRING + "@");
      }
      
      return REDACTED_STRING;
    });
  }
  
  return sanitized;
}

/**
 * Determines whether a file should be captured based on its path.
 *
 * @param filePath - The file path to check
 * @returns true if the file should be captured, false if it should be excluded
 */
export function shouldCaptureFile(filePath: string): boolean {
  if (!filePath || typeof filePath !== "string") {
    return false;
  }

  // Normalize path separators (handle both Windows and Unix)
  const normalizedPath = filePath.replace(/\\/g, "/");
  
  for (const pattern of EXCLUDED_PATH_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Sanitizes a bash command, redacting it if it contains sensitive patterns.
 *
 * @param command - The bash command to sanitize
 * @returns The sanitized command, [REDACTED BASH COMMAND] if sensitive, or null if empty
 */
export function sanitizeBashCommand(command: string): string | null {
  if (!command || typeof command !== "string") {
    return null;
  }

  const trimmedCommand = command.trim();
  
  if (trimmedCommand.length === 0) {
    return null;
  }

  // Check if command matches any sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(trimmedCommand)) {
      return REDACTED_COMMAND_STRING;
    }
  }

  // Check if command matches sensitive bash patterns
  for (const pattern of SENSITIVE_BASH_PATTERNS) {
    if (pattern.test(trimmedCommand)) {
      return REDACTED_COMMAND_STRING;
    }
  }

  return trimmedCommand;
}

/**
 * Quickly checks if content contains sensitive patterns.
 * Useful for early exit optimization.
 *
 * @param content - The content to check
 * @returns true if content contains sensitive patterns
 */
export function isSensitiveContent(content: string): boolean {
  if (!content || typeof content !== "string") {
    return false;
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitizes an object recursively, redacting sensitive values.
 * Preserves object structure but replaces sensitive string values.
 *
 * @param obj - The object to sanitize
 * @returns A new object with sensitive values redacted
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === "string") {
    return sanitizeContent(obj) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }
  
  if (obj !== null && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if the key itself is sensitive
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("password") || 
          lowerKey.includes("secret") || 
          lowerKey.includes("token") || 
          lowerKey.includes("key") ||
          lowerKey.includes("credential")) {
        sanitized[key] = REDACTED_STRING;
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized as T;
  }
  
  return obj;
}

/**
 * Gets a list of exclusion reasons for a file path.
 * Useful for debugging why a file was excluded.
 *
 * @param filePath - The file path to check
 * @returns Array of pattern descriptions that matched, or empty array if file should be captured
 */
export function getExclusionReasons(filePath: string): string[] {
  if (!filePath || typeof filePath !== "string") {
    return ["Invalid path"];
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  const reasons: string[] = [];
  
  const patternDescriptions: [RegExp, string][] = [
    [/\.env$/, ".env file"],
    [/\.env\.\w+$/, ".env variant file"],
    [/\.git\//, "Git directory file"],
    [/\.(key|pem|p12|pfx)$/i, "Certificate/key file"],
    [/secret/i, "Path contains 'secret'"],
    [/password/i, "Path contains 'password'"],
    [/credential/i, "Path contains 'credential'"],
    [/token/i, "Path contains 'token'"],
    [/private/i, "Path contains 'private'"],
  ];
  
  for (const [pattern, description] of patternDescriptions) {
    if (pattern.test(normalizedPath)) {
      reasons.push(description);
    }
  }
  
  return reasons;
}
