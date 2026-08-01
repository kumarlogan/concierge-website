// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Care Companion Chat Panel               │
// │ Patient Journey Hub — chat interface for care team.        │
// │ Wave 6 — Patient Journey Hub                                 │
// └─────────────────────────────────────────────────────────────┘

import { useState, useRef, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send,
  Bot,
  UserCircle,
  Loader2,
  AlertCircle,
  Paperclip,
  Plus,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  name: string;
  url: string;
  type: "image" | "file" | "link";
}

export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  specialty: string;
  avatar?: string;
  status: "online" | "offline" | "busy";
}

// ── Constants ──────────────────────────────────────────

const CARE_TEAM: CareTeamMember[] = [
  {
    id: "dr-chen",
    name: "Dr. Sarah Chen",
    role: "Lead Fertility Specialist",
    specialty: "Reproductive Endocrinology",
    status: "online",
  },
  {
    id: "nurse-patel",
    name: "Priya Patel, RN",
    role: "Care Coordinator",
    specialty: "Patient Navigation",
    status: "online",
  },
  {
    id: "dr-okafor",
    name: "Dr. James Okafor",
    role: "Urologist",
    specialty: "Male Reproductive Health",
    status: "offline",
  },
];

// ── Sub-components ─────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  const roleIcon =
    message.role === "assistant" ? (
      <Bot className="h-4 w-4 text-muted-foreground" />
    ) : message.role === "system" ? (
      <AlertCircle className="h-4 w-4 text-amber-500" />
    ) : (
      <UserCircle className="h-4 w-4 text-primary" />
    );

  return (
    <div
      className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className="mt-1 shrink-0">{roleIcon}</div>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
          isOwn
            ? "bg-primary text-primary-foreground"
            : message.role === "system"
              ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
              : "bg-muted text-muted-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <a
                key={att.url}
                href={att.url}
                className="inline-flex items-center gap-1 rounded-md bg-background/50 px-2 py-1 text-xs underline underline-offset-2"
              >
                <Paperclip className="h-3 w-3" />
                {att.name}
              </a>
            ))}
          </div>
        )}
        <span
          className={`mt-1 block text-[10px] ${
            isOwn ? "text-primary/70" : "text-muted-foreground"
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

function SystemMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

interface ChatPanelProps {
  careTeam?: CareTeamMember[];
  initialMessages?: ChatMessage[];
  onSend?: (message: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
}

export function ChatPanel({
  careTeam = CARE_TEAM,
  initialMessages = [],
  onSend,
  placeholder = "Ask your care team a question...",
  className,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      if (onSend) {
        await onSend(trimmed);
      }

      // Simulated assistant response for UX demo
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Thanks for your message. Your care team will review this and respond shortly. In the meantime, here's your current journey status: ${
          messages.length === 0 ? "Welcome to your Care Companion!" : "We have your message."
        }`,
        timestamp: new Date().toISOString(),
      };

      // Small delay for realistic feel
      await new Promise((r) => setTimeout(r, 600));
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col rounded-lg border bg-card ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex -space-x-2">
          {careTeam.slice(0, 3).map((member) => (
            <Avatar key={member.id} className="h-7 w-7 border-2 border-card">
              <AvatarImage src={member.avatar} alt={member.name} />
              <AvatarFallback className="text-[10px]">
                {member.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">Care Companion</p>
          <p className="text-[11px] text-muted-foreground">
            {careTeam.filter((m) => m.status === "online").length} online
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="New conversation">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 max-h-[400px] p-4">
        {error && (
          <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bot className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Welcome to Care Companion</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              Ask your care team about your treatment plan, upcoming appointments, or any questions about your journey.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <SystemMessage>Today</SystemMessage>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.role === "user"}
              />
            ))}
          </div>
        )}
        {sending && (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Care team is typing...
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Attach file"
            disabled={sending}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={sending}
            className="flex-1"
            aria-label="Chat message"
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!input.trim() || sending}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
