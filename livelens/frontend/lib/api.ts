import { SessionState } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function normalizeArtifactUrl(url?: string | null): string | null | undefined {
  if (!url) {
    return url;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }
  return `${API_BASE_URL}/${url}`;
}

function normalizeSessionState(session: SessionState): SessionState {
  return {
    ...session,
    preview_image_url: normalizeArtifactUrl(session.preview_image_url)
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  return response.json() as Promise<T>;
}

export async function startSession(): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/start`, {
    method: "POST"
  });

  return normalizeSessionState(await parseJson<SessionState>(response));
}

export async function fetchSession(sessionId: string): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`);
  return normalizeSessionState(await parseJson<SessionState>(response));
}

export async function uploadScreenshot(sessionId: string, file: File): Promise<SessionState> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/screenshot`, {
    method: "POST",
    body: formData
  });

  return normalizeSessionState(await parseJson<SessionState>(response));
}

export async function sendUtterance(sessionId: string, text: string): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/utterance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  return normalizeSessionState(await parseJson<SessionState>(response));
}


export async function confirmAction(sessionId: string, approved: boolean): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/actions/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved })
  });

  return normalizeSessionState(await parseJson<SessionState>(response));
}

export async function finalizeSession(sessionId: string): Promise<SessionState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/finalize`, {
    method: "POST"
  });

  return normalizeSessionState(await parseJson<SessionState>(response));
}

