"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
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
}

export function VoiceControls({ phase, latestAgentMessage, onTranscript }: VoiceControlsProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }

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

      if (text) {
        await onTranscript(text);
      }
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognitionRef.current = recognition;
  }, [onTranscript]);

  useEffect(() => {
    if (!latestAgentMessage || typeof window === "undefined") {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latestAgentMessage);
    utterance.rate = 1.03;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [latestAgentMessage]);

  const helperText = useMemo(() => {
    if (!supported) {
      return "Browser speech recognition is unavailable here. Text fallback stays fully supported.";
    }
    if (phase === "awaiting_confirmation") {
      return "Say confirm or cancel, or use the action buttons.";
    }
    return "Tap the mic to speak. Speech output uses the browser voice for the demo path.";
  }, [phase, supported]);

  function toggleListening() {
    if (!recognitionRef.current) {
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      window.speechSynthesis.cancel();
      setListening(false);
      return;
    }

    window.speechSynthesis.cancel();
    recognitionRef.current.start();
    setListening(true);
  }

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Voice Controls</h3>
        <Volume2 className="h-4 w-4 text-sky-300" />
      </div>
      <p className="mb-4 text-sm text-mist">{helperText}</p>
      <button
        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!supported}
        onClick={toggleListening}
        type="button"
      >
        {listening ? <MicOff className="h-4 w-4 text-coral" /> : <Mic className="h-4 w-4 text-glow" />}
        {listening ? "Stop listening" : "Start voice input"}
      </button>
    </section>
  );
}
