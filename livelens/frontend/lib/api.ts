import { SessionMode, SessionState } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  return response.json() as Promise<T>;
}

export async function startSession(mode: SessionMode): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode })
  });

  return parseJson<SessionState>(response);
}

export async function fetchSession(sessionId: string): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`);
  return parseJson<SessionState>(response);
}

export async function uploadScreenshot(sessionId: string, file: File): Promise<SessionState> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/screenshot`, {
    method: "POST",
    body: formData
  });

  return parseJson<SessionState>(response);
}

export async function sendUtterance(sessionId: string, text: string): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/utterance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  return parseJson<SessionState>(response);
}

export async function updateMode(sessionId: string, mode: SessionMode): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode })
  });

  return parseJson<SessionState>(response);
}

export async function confirmAction(sessionId: string, approved: boolean): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/actions/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved })
  });

  return parseJson<SessionState>(response);
}

export async function finalizeSession(sessionId: string): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/finalize`, {
    method: "POST"
  });

  return parseJson<SessionState>(response);
}

export async function seedDemoSession(sessionId: string): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/seed-demo`, {
    method: "POST"
  });
  return parseJson<SessionState>(response);
}
