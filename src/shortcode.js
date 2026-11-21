import { randomInt } from "node:crypto";

// Avoid characters that are easy to confuse (0/O, 1/l/I).
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 7;

export const RESERVED_CODES = new Set([
  "api",
  "delete",
  "favicon.ico",
  "health",
  "robots.txt",
  "shorten",
  "status",
]);

/**
 * Generate a random short code.
 *
 * @param {number} [length]
 * @returns {string}
 */
export function generateCode(length = CODE_LENGTH) {
  let code = "";

  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }

  return code;
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isReserved(code) {
  return RESERVED_CODES.has(code.toLowerCase());
}
