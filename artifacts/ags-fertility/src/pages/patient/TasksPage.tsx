// ┌─────────────────────────────────────────────────────────────┐
// │ Concierge Product — Patient Tasks Page                      │
// │ Task management grouped by status with completion toggle.   │
// │ Workstream A — Patient Journey                              │
// └─────────────────────────────────────────────────────────────┘

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ListTodo,
  RefreshCw,
  CheckCircle2,
  Clock,
  Circle,
  Calendar,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { getTasks, updateTask, type Task } from "@/lib/timeline-api";
import { Link } from "wouter";

const taskStatusConfig = {
  pending: {
    label: "Pending",
    color: "bg-gray-100 text-gray-600",
    icon: Circle,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
} as const;

function getDueDateStatus(dueDate: string | null): "overdue" | "soon" | "ok" | null {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "soon";
  return "ok";
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await getTasks();
      // Sort: pending first, then in_progress, then completed
      const sorted = data.sort((a, b) => {
        const order = { pending: 0, in_progress: 1, completed: 2 };
        return order[a.status] - order[b.status];
      });
      setTasks(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggleStatus = async (task: Task) => {
    try {
      setUpdating(task.id);
      const newStatus = task.status === "completed" ? "pending" : "completed";
      const updated = await updateTask(task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setUpdating(null);
    }
  };

  const filteredTasks = activeTab === "all" ? tasks : tasks.filter((t) => t.status === activeTab);

  const taskCounts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your treatment tasks and to-dos
          </p>
        </div>
        <Link href="/patient/care-plan">
          <Button variant="outline" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            View Care Plan
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <ListTodo className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{taskCounts.all}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
              <Circle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{taskCounts.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{taskCounts.in_progress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{taskCounts.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading tasks...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchTasks}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Tab filters */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList aria-label="Filter tasks by status">
              <TabsTrigger value="all" aria-label={`All tasks (${taskCounts.all})`}>
                All ({taskCounts.all})
              </TabsTrigger>
              <TabsTrigger value="pending" aria-label={`Pending tasks (${taskCounts.pending})`}>
                Pending ({taskCounts.pending})
              </TabsTrigger>
              <TabsTrigger value="in_progress" aria-label={`In progress tasks (${taskCounts.in_progress})`}>
                In Progress ({taskCounts.in_progress})
              </TabsTrigger>
              <TabsTrigger value="completed" aria-label={`Completed tasks (${taskCounts.completed})`}>
                Completed ({taskCounts.completed})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Task List */}
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">
                  {activeTab === "all" ? "No tasks yet" : `No ${activeTab.replace("_", " ")} tasks`}
                </h3>
                <p className="text-muted-foreground text-center mt-1">
                  {activeTab === "all"
                    ? "Your treatment tasks will appear here once assigned."
                    : "No tasks match this filter."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" role="list" aria-label="Treatment tasks">
              {filteredTasks.map((task) => {
                const config = taskStatusConfig[task.status];
                const dueStatus = getDueDateStatus(task.dueDate);
                const isUpdating = updating === task.id;

                return (
                  <Card key={task.id} role="listitem" className="transition-shadow hover:shadow-sm">
                    <CardContent className="flex items-start gap-4 py-4">
                      <div className="pt-0.5">
                        <Checkbox
                          checked={task.status === "completed"}
                          disabled={isUpdating}
                          onCheckedChange={() => handleToggleStatus(task)}
                          aria-label={`Mark "${task.title}" as ${task.status === "completed" ? "pending" : "completed"}`}
                          className={
                            task.status === "completed"
                              ? "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                              : ""
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3
                            className={`font-medium ${
                              task.status === "completed" ? "text-muted-foreground line-through" : ""
                            }`}
                          >
                            {task.title}
                          </h3>
                          <Badge className={config.color}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {task.dueDate && (
                            <span
                              className={`flex items-center gap-1 ${
                                dueStatus === "overdue"
                                  ? "text-red-600 font-medium"
                                  : dueStatus === "soon"
                                    ? "text-amber-600 font-medium"
                                    : ""
                              }`}
                            >
                              {dueStatus === "overdue" ? (
                                <AlertCircle className="h-3 w-3" />
                              ) : (
                                <Calendar className="h-3 w-3" />
                              )}
                              {dueStatus === "overdue"
                                ? `Overdue: ${new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                                : dueStatus === "soon"
                                  ? `Due soon: ${new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                                  : `Due: ${new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Created: {new Date(task.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          {task.completedAt && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Completed: {new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}