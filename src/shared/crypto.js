import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';

/**
 * Derive a 32-byte encryption key from the Directus SECRET.
 */
function deriveKey(secret) {
	return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns "enc:<base64(iv + authTag + ciphertext)>"
 */
export function encrypt(plaintext, secret) {
	const key = deriveKey(secret);
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();

	const combined = Buffer.concat([iv, authTag, encrypted]);
	return PREFIX + combined.toString('base64');
}

/**
 * Decrypt a value produced by encrypt().
 * Expects "enc:<base64(iv + authTag + ciphertext)>"
 */
export function decrypt(encryptedValue, secret) {
	if (!isEncrypted(encryptedValue)) {
		return encryptedValue;
	}

	const key = deriveKey(secret);
	const combined = Buffer.from(encryptedValue.slice(PREFIX.length), 'base64');

	const iv = combined.subarray(0, IV_LENGTH);
	const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return decrypted.toString('utf8');
}

/**
 * Check if a value is already encrypted (has the enc: prefix).
 */
export function isEncrypted(value) {
	return typeof value === 'string' && value.startsWith(PREFIX);
}
