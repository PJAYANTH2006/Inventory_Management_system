import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'inventory-secret-dev-12345-key-do-not-use-in-prod'
);

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SELLER';
}

/**
 * Signs a payload to generate a JWT.
 */
export async function signJWT(payload: UserSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

/**
 * Verifies a JWT and extracts the session details.
 */
export async function verifyJWT(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch (error) {
    return null;
  }
}

/**
 * Retrieves the current session from the cookies.
 */
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return verifyJWT(token);
}
