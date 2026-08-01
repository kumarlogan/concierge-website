// Document Preview Component.
// Renders a preview of the selected document with metadata.

import { useState, useEffect } from "react";
import {
  Eye,
  Download,
  Share2,
  Clock,
  Shield,
  FileText,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOCUMENT_CATEGORIES,
  type DocumentCategoryId,
} from "@/lib/document-categories";
import { DocumentStatus, statusLabel, statusColor } from "@/lib/document-status";
import { getPreviewUrl, downloadDocument } from "@/lib/document-api";
import { toast } from "@/components/ui/sonner";

interface DocumentPreviewProps {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentPreview({ documentId, open, onOpenChange }: DocumentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getPreviewUrl(documentId)
      .then((url) => {
        setPreviewUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast.info("Preview not available for this document type");
      });
  }, [open, documentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Document Preview</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setZoom(1)}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4">
          {/* Preview Area */}
          <div className="flex-1 border rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center min-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full min-h-[400px] border-0"
                title="Document Preview"
                style={{ zoom }}
              />
            ) : (
              <div className="text-center p-8">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Preview not available for this document type.
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                  downloadDocument(documentId).then(() => toast.success("Download started"));
                }}>
                  <Download className="h-4 w-4 mr-2" /> Download instead
                </Button>
              </div>
            )}
          </div>

          {/* Metadata Sidebar */}
          <div className="w-64 space-y-4 shrink-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Document Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={statusColor(DocumentStatus.UPLOADED) as "default"}>
                    {statusLabel(DocumentStatus.UPLOADED)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span>Medical Reports</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PHI Classification</span>
                  <Shield className="h-3 w-3 inline" />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span>1</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full">
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                <Share2 className="h-4 w-4 mr-2" /> Share
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
