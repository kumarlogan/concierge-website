// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Clinic Messages Page                    │
// │ Clinic view of patient messages, triage queue,              │
// │ message templates for quick replies.                        │
// │ Workstream B — Clinic Experience                             │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Send,
  RefreshCw,
  AlertCircle,
  Flag,
  Users,
  Clock,
  ArrowLeft,
  Inbox,
  FileText,
  ChevronRight,
  Filter,
} from "lucide-react";

interface TriageItem {
  threadId: string;
  patientId: string;
  patientName: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageType: string;
  unreadCount: number;
  priority: "high" | "medium" | "low";
  flagged: boolean;
}

interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  category: string;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isFromPatient: boolean;
}

const _mockTriageQueue: TriageItem[] = [
  { threadId: "triage-001", patientId: "patient-001", patientName: "Alice Johnson", lastMessage: "I'm experiencing some side effects from the medication. Should I be concerned?", lastMessageAt: "2026-07-27T09:30:00Z", lastMessageType: "text", unreadCount: 2, priority: "high", flagged: true },
  { threadId: "triage-002", patientId: "patient-002", patientName: "Bob Smith", lastMessage: "Can I reschedule my appointment next week?", lastMessageAt: "2026-07-26T14:15:00Z", lastMessageType: "text", unreadCount: 1, priority: "medium", flagged: false },
  { threadId: "triage-003", patientId: "patient-005", patientName: "Eva Martinez", lastMessage: "Thank you for the information! I will review and get back to you.", lastMessageAt: "2026-07-25T16:00:00Z", lastMessageType: "text", unreadCount: 0, priority: "low", flagged: false },
  { threadId: "triage-004", patientId: "patient-007", patientName: "Grace Lee", lastMessage: "Is it normal to feel bloated after the procedure?", lastMessageAt: "2026-07-27T08:15:00Z", lastMessageType: "text", unreadCount: 3, priority: "high", flagged: false },
  { threadId: "triage-005", patientId: "patient-009", patientName: "Iris Chen", lastMessage: "I need to update my insurance information for the upcoming appointment.", lastMessageAt: "2026-07-26T11:00:00Z", lastMessageType: "text", unreadCount: 1, priority: "medium", flagged: true },
];

const _mockTemplates: MessageTemplate[] = [
  { id: "tmpl-001", title: "Appointment Reminder", content: "Dear {patientName}, this is a reminder of your upcoming appointment on {appointmentDate} at {appointmentTime}.", category: "appointment" },
  { id: "tmpl-002", title: "Test Results Available", content: "Dear {patientName}, your recent test results are now available. Please schedule a follow-up appointment.", category: "results" },
  { id: "tmpl-003", title: "Welcome Message", content: "Dear {patientName}, welcome to our clinic! Please complete your intake forms before your first appointment.", category: "onboarding" },
  { id: "tmpl-004", title: "Follow-up Request", content: "Dear {patientName}, your provider has requested a follow-up appointment.", category: "follow-up" },
  { id: "tmpl-005", title: "General Response", content: "Dear {patientName}, thank you for your message. We have received it and will get back to you shortly.", category: "general" },
];

const _mockMessages: Record<string, Message[]> = {
  "triage-001": [
    { id: "msg-001", senderId: "patient-001", content: "I'm experiencing some side effects from the medication. Should I be concerned?", createdAt: "2026-07-27T09:30:00Z", isFromPatient: true },
    { id: "msg-002", senderId: "clinic", content: "Thank you for reaching out. Could you describe the side effects in more detail?", createdAt: "2026-07-27T09:35:00Z", isFromPatient: false },
    { id: "msg-003", senderId: "patient-001", content: "I've been feeling nauseous and have had headaches for the past two days.", createdAt: "2026-07-27T09:40:00Z", isFromPatient: true },
    { id: "msg-004", senderId: "patient-001", content: "Is this normal or should I stop the medication?", createdAt: "2026-07-27T09:41:00Z", isFromPatient: true },
  ],
  "triage-002": [
    { id: "msg-005", senderId: "patient-002", content: "Can I reschedule my appointment next week?", createdAt: "2026-07-26T14:15:00Z", isFromPatient: true },
  ],
};

function priorityColor(p: string): string {
  switch (p) {
    case "high": return "text-red-500";
    case "medium": return "text-amber-500";
    case "low": return "text-blue-500";
    default: return "text-gray-500";
  }
}

function priorityBg(p: string): string {
  switch (p) {
    case "high": return "bg-red-50 border-red-200";
    case "medium": return "bg-amber-50 border-amber-200";
    case "low": return "bg-blue-50 border-blue-200";
    default: return "";
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ClinicMessagesPage() {
  const [triageQueue, setTriageQueue] = useState<TriageItem[]>(_mockTriageQueue);
  const [templates] = useState<MessageTemplate[]>(_mockTemplates);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState("all");

  const fetchTriage = async () => {
    setLoading(true);
    try {
      // In production: const res = await fetch('/api/v1/clinic/messages/triage');
      // const data = await res.json();
      // setTriageQueue(data.queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTriage();
  }, []);

  const openThread = (threadId: string) => {
    setSelectedThread(threadId);
    setMessages(_mockMessages[threadId] || []);
    setNewMessage("");
    setSelectedTemplate("");
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread) return;
    try {
      const msg: Message = {
        id: `msg-${Date.now()}`,
        senderId: "clinic",
        content: newMessage.trim(),
        createdAt: new Date().toISOString(),
        isFromPatient: false,
      };
      setMessages((prev) => [...prev, msg]);
      setNewMessage("");
      setSelectedTemplate("");
      // In production: await fetch('/api/v1/clinic/messages/send', { method: 'POST', body: JSON.stringify({...}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    }
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setNewMessage(template.content.replace(/\{patientName\}/g, "Patient"));
    }
  };

  const filteredQueue = triageQueue.filter((item) => {
    if (filterPriority !== "all" && item.priority !== filterPriority) return false;
    return true;
  });

  const highPriorityCount = triageQueue.filter((i) => i.priority === "high").length;

  // Thread list view
  if (!selectedThread) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
            <p className="mt-1 text-muted-foreground">
              Patient message triage queue
              {highPriorityCount > 0 && (
                <span className="ml-2 text-red-500 font-medium">
                  ({highPriorityCount} high priority)
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTriage}>
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filter:</span>
            <div className="flex gap-2">
              {["all", "high", "medium", "low"].map((p) => (
                <Button
                  key={p}
                  variant={filterPriority === p ? "default" : "outline"}
                  size="sm"
                  className="capitalize"
                  onClick={() => setFilterPriority(p)}
                >
                  {p === "all" ? "All" : p}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-800">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredQueue.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No messages in queue</h3>
              <p className="text-muted-foreground text-center mt-1">
                All patient messages have been addressed.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Triage queue */}
        {!loading && !error && filteredQueue.length > 0 && (
          <div className="space-y-3">
            {filteredQueue.map((item) => (
              <Card
                key={item.threadId}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  item.unreadCount > 0 ? "ring-1 ring-primary/20" : ""
                } ${priorityBg(item.priority)}`}
                onClick={() => openThread(item.threadId)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="relative flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    {item.unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
                        {item.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.patientName}</p>
                      <Badge
                        variant="outline"
                        className={`${priorityColor(item.priority)} capitalize text-xs`}
                      >
                        {item.priority}
                      </Badge>
                      {item.flagged && <Flag className="h-3 w-3 text-red-500" />}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground truncate">
                      {item.lastMessage}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(item.lastMessageAt)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
  const currentThread = triageQueue.find((t) => t.threadId === selectedThread);
  const threadTemplates = templates.filter((t) => t.category !== "general");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{currentThread?.patientName}</h1>
          <p className="text-xs text-muted-foreground">
            {currentThread?.priority && (
              <Badge variant="outline" className={`${priorityColor(currentThread.priority)} capitalize mr-2`}>
                {currentThread.priority} priority
              </Badge>
            )}
            {currentThread?.flagged && <Flag className="h-3 w-3 inline text-red-500 mr-1" />}
            Thread: {selectedThread}
          </p>
        </div>
      </div>

      {/* Messages */}
      <Card>
        <CardContent className="max-h-[400px] space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">No messages in this thread yet.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isFromPatient ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.isFromPatient
                    ? "bg-muted"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p
                  className={`mt-1 text-xs ${
                    msg.isFromPatient
                      ? "text-muted-foreground"
                      : "text-primary-foreground/70"
                  }`}
                >
                  {formatTime(msg.createdAt)}
                  {!msg.isFromPatient && " · Clinic"}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Templates */}
      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose" className="gap-2">
            <Send className="h-4 w-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-3">
          <Textarea
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={4}
          />
          <div className="flex justify-between">
            <p className="text-xs text-muted-foreground">
              {selectedTemplate && `Using template: ${templates.find(t => t.id === selectedTemplate)?.title}`}
            </p>
            <Button onClick={handleSend} disabled={!newMessage.trim()}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid gap-3 sm:grid-cols-2">
            {threadTemplates.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedTemplate === template.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => applyTemplate(template.id)}
              >
                <CardContent className="p-3">
                  <p className="text-sm font-medium">{template.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {template.content}
                  </p>
                  <Badge variant="outline" className="mt-2 text-xs capitalize">
                    {template.category}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // In production: PATCH /api/v1/clinic/messages/threads/:threadId/flag
            if (currentThread) {
              setTriageQueue((prev) =>
                prev.map((t) =>
                  t.threadId === selectedThread ? { ...t, flagged: !t.flagged } : t,
                ),
              );
            }
          }}
        >
          <Flag className="mr-1 h-3 w-3" />
          {currentThread?.flagged ? "Unflag" : "Flag Thread"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Mark as handled - in production this would update the DB
            setSelectedThread(null);
          }}
        >
          <CheckCircle2Icon className="mr-1 h-3 w-3" />
          Mark as Handled
        </Button>
      </div>
    </div>
  );
}

// Helper component for inline icon usage
function CheckCircle2Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}