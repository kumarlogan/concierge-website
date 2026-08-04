// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy — Workflow Activity Page (Wave 8)                 │
// │ Workflow instance viewer with state visualization,          │
// │ task list, approval status, timeline, and audit trail.     │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Workflow,
  RefreshCw,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  PauseCircle,
  PlayCircle,
  SkipForward,
  ShieldCheck,
  FileText,
  MessageSquare,
  Bell,
  Activity,
  ListChecks,
  History,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import { getWorkflow, getWorkflowTasks, getWorkflowAudit, type WorkflowInstance, type TaskInstance, type AuditEntry } from "@/lib/workflow-api";

type WorkflowTab = "overview" | "tasks" | "approvals" | "audit" | "timeline";

export default function WorkflowActivityPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [, navigate] = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowInstance | null>(null);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkflowTab>("overview");
  const [taskFilter, setTaskFilter] = useState<string>("all");

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) return;
    try {
      setLoading(true);
      setError(null);
      const [wfData, taskData, auditData] = await Promise.all([
        getWorkflow(workflowId),
        getWorkflowTasks(workflowId),
        getWorkflowAudit(workflowId),
      ]);
      setWorkflow(wfData);
      setTasks(taskData);
      setAudit(auditData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const stateColorMap: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    requested: "bg-blue-100 text-blue-700",
    received: "bg-indigo-100 text-indigo-700",
    accepted: "bg-purple-100 text-purple-700",
    claimed: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-gray-200 text-gray-500",
    escalated: "bg-red-200 text-red-800",
  };

  const priorityColorMap: Record<string, string> = {
    low: "bg-gray-100 text-gray-600",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
  };

  const filteredTasks = taskFilter === "all" ? tasks : tasks.filter((t) => t.state === taskFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error || "Workflow not found"}</span>
            </div>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/patient/hub")}>
              Back to Hub
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/patient/hub")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6" />
            {workflow.workflowType}
          </h1>
          <p className="text-sm text-muted-foreground">
            Instance: {workflow.id.slice(0, 8)}… | Created {new Date(workflow.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Badge className={stateColorMap[workflow.currentState] || "bg-gray-100 text-gray-700"}>
          {workflow.currentState.replace(/_/g, " ")}
        </Badge>
        <Button variant="outline" size="sm" onClick={fetchWorkflow}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={workflow.progress ?? 0} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{tasks.filter((t) => t.state === "completed").length} of {tasks.length} tasks complete</span>
            <span>{workflow.progress ?? 0}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkflowTab)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-1">
            <History className="h-3 w-3" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Audit
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">State Machine</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="flex flex-wrap gap-1">
                  {workflow.stateHistory?.map((state, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded text-xs ${stateColorMap[state] || "bg-gray-100"}`}>
                      {state.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Context</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <pre className="whitespace-pre-wrap text-xs bg-muted/50 p-2 rounded">
                  {JSON.stringify(workflow.context, null, 2).slice(0, 500)}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><Badge className={priorityColorMap[workflow.priority]}>{workflow.priority}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(workflow.createdAt).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span>{new Date(workflow.updatedAt).toLocaleString()}</span></div>
                {workflow.slaDeadline && <div className="flex justify-between"><span className="text-muted-foreground">SLA Deadline</span><span>{new Date(workflow.slaDeadline).toLocaleString()}</span></div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center gap-2">
            <Input placeholder="Filter tasks..." className="max-w-xs" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} />
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{task.description?.slice(0, 100)}</p>
                    </div>
                    <Badge className={stateColorMap[task.state] || "bg-gray-100"}>{task.state.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {task.priority}</span>
                    {task.assignedTo && <span>Assigned: {task.assignedTo}</span>}
                    {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredTasks.length === 0 && (
              <Card><CardContent className="pt-6 text-center text-muted-foreground text-sm">No tasks found</CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Approval Gates</CardTitle></CardHeader>
            <CardContent>
              {workflow.approvalGates?.length ? (
                <div className="space-y-3">
                  {workflow.approvalGates.map((gate, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium text-sm">{gate.gateType}</span>
                        <p className="text-xs text-muted-foreground">{gate.description || "No description"}</p>
                      </div>
                      <Badge variant={gate.status === "approved" ? "default" : gate.status === "rejected" ? "destructive" : "secondary"}>
                        {gate.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No approval gates for this workflow</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Workflow Timeline</CardTitle></CardHeader>
            <CardContent>
              {workflow.timelineEvents?.length ? (
                <div className="space-y-3">
                  {workflow.timelineEvents.map((event, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-primary mt-1" />
                        {i < workflow.timelineEvents!.length - 1 && <div className="w-0.5 bg-border flex-1 min-h-[20px]" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
                        {event.description && <p className="text-xs mt-1">{event.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No timeline events</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
            <CardContent>
              {audit.length ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {audit.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 p-2 border-b last:border-0 text-sm">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      <span className="font-medium">{entry.action}</span>
                      <span className="text-muted-foreground">{entry.actor}</span>
                      {entry.details && <span className="text-xs text-muted-foreground ml-auto">{JSON.stringify(entry.details).slice(0, 100)}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No audit entries</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
