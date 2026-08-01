// Document Centre — Patient Documents page.
// Wave 5 — AG Synergy Document Centre.
// Patients manage all treatment-related documents in one unified experience.

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FolderOpen,
  Upload,
  Search,
  Filter,
  Download,
  Eye,
  Share2,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  File,
  Image,
  Shield,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  Lock,
  Unlock,
  History,
  Tag,
} from "lucide-react";
import {
  DOCUMENT_CATEGORIES,
  type DocumentCategoryId,
} from "@/lib/document-categories";
import {
  DocumentStatus,
  statusLabel,
  statusColor,
} from "@/lib/document-status";
import {
  fetchDocuments,
  downloadDocument,
  getPreviewUrl,
  shareDocument,
  revokeShare,
  fetchAuditTrail,
  invalidateDocumentCache,
  type DocumentListItem,
  type DocumentDetail,
  type AuditEntry,
} from "@/lib/document-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function categoryIcon(category: string) {
  switch (category) {
    case "passport":
      return <Shield className="h-4 w-4" />;
    case "visa":
      return <Shield className="h-4 w-4" />;
    case "medical-reports":
      return <FileText className="h-4 w-4" />;
    case "lab-results":
      return <FileText className="h-4 w-4" />;
    case "treatment-docs":
      return <FileText className="h-4 w-4" />;
    case "consent-forms":
      return <FileText className="h-4 w-4" />;
    case "prescriptions":
      return <FileText className="h-4 w-4" />;
    case "financial-docs":
      return <File className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

// ── Document Row ──────────────────────────────────────────

function DocumentRow({
  doc,
  onDownload,
  onPreview,
  onShare,
  onDelete,
}: {
  doc: DocumentListItem;
  onDownload: (id: string) => void;
  onPreview: (id: string) => void;
  onShare: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);

  const status = doc.status as DocumentStatus;
  const color = statusColor(status);

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {categoryIcon(doc.category)}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{doc.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {doc.mimeType} · {formatFileSize(doc.fileSize)} · v{doc.version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={color as "default"}>{statusLabel(status)}</Badge>
          <Button variant="ghost" size="icon" onClick={() => onPreview(doc.id)} title="Preview">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDownload(doc.id)} title="Download">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onShare(doc.id)} title="Share">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(doc.id)} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setShowAudit(!showAudit); if (!showAudit) fetchAuditTrail(doc.id).then(setAuditLog); }} title="Audit History">
            <History className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Category:</span>{" "}
              {DOCUMENT_CATEGORIES.find((c) => c.id === doc.category)?.label ?? doc.category}
            </div>
            <div>
              <span className="text-muted-foreground">Uploaded:</span>{" "}
              {formatDate(doc.uploadedAt)}
            </div>
            <div>
              <span className="text-muted-foreground">Expires:</span>{" "}
              {formatDate(doc.expiresAt)}
            </div>
            <div>
              <span className="text-muted-foreground">PHI Classification:</span>{" "}
              {doc.phiClassification}
            </div>
          </div>

          {showAudit && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold mb-2">Audit Trail</h4>
              <ScrollArea className="h-32">
                {auditLog.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No audit entries yet.</p>
                ) : (
                  auditLog.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 text-xs py-1 border-b last:border-0">
                      <span className="text-muted-foreground shrink-0">{formatDate(entry.timestamp)}</span>
                      <span className="font-medium">{entry.action}</span>
                      <span className="text-muted-foreground">by {entry.actor}</span>
                      <span className="text-muted-foreground truncate">{entry.details}</span>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Upload Dialog ─────────────────────────────────────────

function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file || !selectedCategory) return;
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const init = await fetchDocuments(); // TODO: replace with initiateUpload for proper upload flow
      // In production: initiateUpload → uploadToPresignedUrl
      toast.success(`Uploading ${file.name}...`);
      setProgress(100);
      invalidateDocumentCache();
      onUploaded();
      onOpenChange(false);
      setFile(null);
      setSelectedCategory("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a document to your secure document centre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select document category" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">File</label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} ({formatFileSize(file.size)})
              </p>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">Uploading...</p>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || !selectedCategory || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Document Detail Dialog ────────────────────────────────

function DocumentDetailDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: DocumentDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{doc.fileName}</DialogTitle>
          <DialogDescription>
            {doc.mimeType} · {formatFileSize(doc.fileSize)} · Version {doc.version}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Category:</span>{" "}
              {DOCUMENT_CATEGORIES.find((c) => c.id === doc.category)?.label}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <Badge variant={statusColor(doc.status as DocumentStatus) as "default"}>
                {statusLabel(doc.status as DocumentStatus)}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Uploaded:</span>{" "}
              {formatDate(doc.uploadedAt)}
            </div>
            <div>
              <span className="text-muted-foreground">Expires:</span>{" "}
              {formatDate(doc.expiresAt)}
            </div>
            <div>
              <span className="text-muted-foreground">PHI Classification:</span>{" "}
              {doc.phiClassification}
            </div>
            <div>
              <span className="text-muted-foreground">Storage:</span>{" "}
              {doc.downloadUrl ? "Available" : "Not available"}
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Missing Documents Alert ───────────────────────────────

function MissingDocumentsAlert({
  missingRequired,
}: {
  missingRequired: string[];
}) {
  if (missingRequired.length === 0) return null;

  return (
    <Card className="border-warning bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-warning flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Required Documents Missing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-2">
          The following required documents are missing. Please upload them to complete your profile:
        </p>
        <ul className="space-y-1">
          {missingRequired.map((catId) => {
            const cat = DOCUMENT_CATEGORIES.find((c) => c.id === catId);
            return (
              <li key={catId} className="text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                {cat?.label ?? catId}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Expiring Documents Alert ──────────────────────────────

function ExpiringDocumentsAlert({
  expiringDocs,
}: {
  expiringDocs: DocumentListItem[];
}) {
  if (expiringDocs.length === 0) return null;

  return (
    <Card className="border-warning bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-warning flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Documents Expiring Soon
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-2">
          The following documents are approaching their expiry date:
        </p>
        <ul className="space-y-1">
          {expiringDocs.map((doc) => (
            <li key={doc.id} className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              {doc.fileName} — expires {formatDate(doc.expiresAt)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Main Document Centre Page ─────────────────────────────

export function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailDoc, setDetailDoc] = useState<DocumentDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
  });

  const filteredDocs = useMemo(() => {
    if (!data?.documents) return [];
    return data.documents.filter((doc) => {
      const matchesSearch =
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || doc.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" || doc.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [data?.documents, searchQuery, categoryFilter, statusFilter]);

  const missingRequired = data?.missingRequired ?? [];
  const expiringDocs = (data?.documents ?? []).filter(
    (d) => d.status === DocumentStatus.EXPIRING,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">
            Failed to load documents. Please try again.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Centre</h1>
          <p className="text-muted-foreground text-sm">
            Manage all your treatment-related documents in one place.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" /> Upload Document
        </Button>
      </div>

      <MissingDocumentsAlert missingRequired={missingRequired} />
      <ExpiringDocumentsAlert expiringDocs={expiringDocs} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.values(DocumentStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredDocs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No documents found matching your filters.</p>
              <p className="text-xs mt-1">Upload documents to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onDownload={(id) => downloadDocument(id).then(() => toast.success("Download started"))}
                  onPreview={(id) => {
                    getPreviewUrl(id).then((url) => {
                      if (url) window.open(url, "_blank");
                      else toast.info("Preview not available for this document type");
                    });
                  }}
                  onShare={(id) => {
                    const shareWith = prompt("Enter email to share with:");
                    if (shareWith) {
                      shareDocument(id, shareWith, "viewer").then(() => {
                        toast.success("Document shared successfully");
                      });
                    }
                  }}
                  onDelete={(id) => {
                    // In production: confirm then delete
                    toast.info("Delete functionality requires confirmation");
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => refetch()}
      />

      <DocumentDetailDialog
        doc={detailDoc}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

export default DocumentsPage;
