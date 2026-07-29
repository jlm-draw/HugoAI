import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "hugoai-super-secret-key-change-in-production";
const secret = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
  userId: string;
  username: string;
  isSuperAdmin: boolean;
}

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validateStrongPassword(password: string): { valid: boolean; message: string } {
  if (password.length < 12) {
    return { valid: false, message: "密码长度至少12位" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "密码必须包含小写字母" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "密码必须包含大写字母" };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: "密码必须包含数字" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, message: "密码必须包含特殊字符" };
  }
  return { valid: true, message: "密码强度合格" };
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  const isHttps = process.env.APP_URL?.startsWith("https://");
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: !!isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("auth-token")?.value;
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return verifyToken(token);
}
