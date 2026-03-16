"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { AgentPhase } from "@/lib/types";

type SpeechRecognitionCtor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
  }

  interface SpeechRecognitionEvent {
    results: any;
  }
}

interface VoiceControlsProps {
  phase: AgentPhase;
  latestAgentMessage?: string;
  onTranscript: (text: string) => Promise<void>;
  disabled?: boolean;
}

export function VoiceControls({
  phase,
  latestAgentMessage,
  onTranscript,
  disabled = false,
}: VoiceControlsProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    setSupported(true);
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = async (event) => {
      const text = Array.from(event.results as any[])
        .map((result: any) => result[0].transcript)
        .join(" ")
        .trim();
      if (text) await onTranscript(text);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, [onTranscript]);

  useEffect(() => {
    if (!latestAgentMessage || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latestAgentMessage);
    utterance.rate = 1.03;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [latestAgentMessage]);

  function toggle() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      window.speechSynthesis.cancel();
      setListening(false);
    } else {
      window.speechSynthesis.cancel();
      recognitionRef.current.start();
      setListening(true);
    }
  }

  if (!supported) return null;

  return (
    <button
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition
        ${listening
          ? "bg-coral/20 border border-coral/50 text-coral animate-pulse"
          : "bg-white/8 border border-white/15 text-glow hover:bg-white/12"
        }
        disabled:opacity-40 disabled:cursor-not-allowed
      `}
      disabled={disabled || phase === "thinking"}
      onClick={toggle}
      title={listening ? "Stop listening" : "Speak your question"}
      type="button"
    >
      {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}
