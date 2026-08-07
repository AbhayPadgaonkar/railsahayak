const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SESSION_KEY = "railsahayak_session";

export interface AuthSession {
  token: string;
  controller_id: string;
  name: string;
  section: string;
}

export function saveSession(session: AuthSession): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
  }
}

export async function login(
  controllerId: string,
  password: string
): Promise<AuthSession> {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ controller_id: controllerId, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Login failed (${res.status})`);
  }
  const session = (await res.json()) as AuthSession;
  saveSession(session);
  return session;
}

export async function logout(): Promise<void> {
  const session = getSession();
  if (session) {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
    }).catch(() => {});
  }
  clearSession();
}
