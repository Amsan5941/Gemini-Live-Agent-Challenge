export type SessionMode = "observe" | "assist" | "act";
export type AgentPhase = "idle" | "listening" | "thinking" | "speaking" | "awaiting_confirmation";

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  detail?: string;
}

export interface ActionLogItem {
  id: string;
  timestamp: string;
  status: "suggested" | "confirmed" | "executed" | "failed";
  description: string;
}

export interface AgentMessage {
  id: string;
  speaker: "agent" | "user";
  text: string;
  created_at: string;
}

export interface SuggestedAction {
  action_id: string;
  type: "click" | "type" | "scroll" | "select";
  target: string;
  value?: string;
  reason: string;
  requires_confirmation: boolean;
}

export interface SessionState {
  session_id: string;
  mode: SessionMode;
  phase: AgentPhase;
  transcript: AgentMessage[];
  checklist: ChecklistItem[];
  action_log: ActionLogItem[];
  screen_summary?: string;
  suggested_action?: SuggestedAction | null;
  latest_summary?: string | null;
  preview_image_url?: string | null;
}
