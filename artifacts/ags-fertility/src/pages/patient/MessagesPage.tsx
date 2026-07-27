// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Messages Page                    │
// │ Secure messaging with providers.                            │
// │ Wave 8 — End-to-End Integration                              │
// │ Wave 8.1 — Shared API adoption: uses message-api.ts          │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Send,
  RefreshCw,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import { getThreads, getThreadMessages, sendMessage } from "@/lib/message-api";

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  type: string;
  status: string;
  subject: string | null;
  content: string;
  contentType: string;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
}

interface Thread {
  threadId: string;
  lastMessage: Message;
  unreadCount: number;
}

function statusDot(status: string) {
  switch (status) {
    case "sent":
      return "bg-blue-500";
    case "delivered":
      return "bg-green-500";
    case "read":
      return "bg-gray-400";
    default:
      return "bg-gray-300";
  }
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const participantId = user?.id ?? "anonymous";

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const data = await getThreads();
      setThreads(data as Thread[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (threadId: string) => {
    try {
      const data = await getThreadMessages(threadId);
      setMessages(data as Message[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread);
    }
  }, [selectedThread]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread) return;
    try {
      await sendMessage({
        threadId: selectedThread,
        recipientId: "provider-001",
        type: "text",
        subject: null as unknown as string,
        content: newMessage.trim(),
      });
      setNewMessage("");
      fetchMessages(selectedThread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    }
  };

  // Thread list view
  if (!selectedThread) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground mt-1">
            Secure messaging with your care team
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-800">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && threads.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No messages yet</h3>
              <p className="text-muted-foreground text-center mt-1">
                Start a conversation with your care team.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && threads.length > 0 && (
          <div className="space-y-3">
            {threads.map((thread) => (
              <Card
                key={thread.threadId}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedThread(thread.threadId)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="relative">
                    <MessageSquare className="h-10 w-10 text-muted-foreground" />
                    {thread.unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                        {thread.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {thread.lastMessage.subject ?? "Conversation"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {thread.lastMessage.content}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {new Date(thread.lastMessage.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Message thread view
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-xl font-semibold">Conversation</h1>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.map((msg) => (
          <Card
            key={msg.id}
            className={
              msg.senderId === participantId
                ? "ml-8 border-blue-200 bg-blue-50"
                : "mr-8"
            }
          >
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {msg.senderId === participantId ? "You" : "Care Team"}
                </span>
                <div className={`h-1.5 w-1.5 rounded-full ${statusDot(msg.status)}`} />
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm">{msg.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compose */}
      <div className="flex gap-2">
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} disabled={!newMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}