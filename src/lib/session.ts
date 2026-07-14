import { cookies } from "next/headers";
import crypto from "crypto";

export interface SessionUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  role: string; // CUSTOMER, KITCHEN, ADMIN
  balance?: number;
}

// AES-256-CBC Settings
const ALGORITHM = "aes-256-cbc";
// Generate a 32-byte key derived from a secret passphrase
const SECRET_KEY = crypto
  .createHash("sha256")
  .update(process.env.SESSION_SECRET || "campusbite_super_secret_session_passphrase_value_2026")
  .digest();
const IV_LENGTH = 16;

/**
 * Encrypts cleartext session JSON into AES-256-CBC cipher.
 */
function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  const encryptedBytes1 = cipher.update(Buffer.from(text, "utf8"));
  const encryptedBytes2 = cipher.final();
  const encryptedBuffer = Buffer.concat([encryptedBytes1, encryptedBytes2]);
  return iv.toString("hex") + ":" + encryptedBuffer.toString("hex");
}

/**
 * Decrypts encrypted session hex string. Returns empty string on error or tamper.
 */
function decrypt(cipherText: string): string {
  try {
    const textParts = cipherText.split(":");
    const ivHex = textParts.shift();
    const encryptedHex = textParts.join(":");
    if (!ivHex || !encryptedHex) return "";

    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    
    const decryptedBytes1 = decipher.update(encryptedText);
    const decryptedBytes2 = decipher.final();
    return Buffer.concat([decryptedBytes1, decryptedBytes2]).toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Retrieves, decrypts, and deserializes the user session cookie.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("campusbite_session");
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }
  try {
    const decrypted = decrypt(sessionCookie.value);
    if (!decrypted) return null;
    return JSON.parse(decrypted) as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Serializes, encrypts, and stores user details inside a secure HTTP-Only cookie.
 */
export async function setSession(user: SessionUser): Promise<void> {
  const cookieStore = await cookies();
  const encryptedValue = encrypt(JSON.stringify(user));
  cookieStore.set("campusbite_session", encryptedValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

/**
 * Deletes user session cookie from browser.
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("campusbite_session");
}
