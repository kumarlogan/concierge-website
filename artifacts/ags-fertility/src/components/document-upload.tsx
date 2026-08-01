// Document Upload Component.
// Reusable upload widget for the Document Centre.

import { useState, useCallback } from "react";
import { Upload, File, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { DOCUMENT_CATEGORIES, type DocumentCategoryId } from "@/lib/document-categories";
import { formatFileSize } from "@/lib/document-status";

interface UploadFile {
  file: File;
  category: DocumentCategoryId;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
  documentId?: string;
}

interface DocumentUploadProps {
  onUploadComplete?: () => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  maxSizeMB?: number;
}

export function DocumentUpload({
  onUploadComplete,
  maxFiles = 10,
  acceptedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  maxSizeMB = 50,
}: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const remaining = maxFiles - files.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const toAdd = Array.from(newFiles)
        .slice(0, remaining)
        .map((file) => ({
          file,
          category: "medical-reports" as DocumentCategoryId,
          progress: 0,
          status: "pending" as const,
        }));

      setFiles((prev) => [...prev, ...toAdd]);
    },
    [files.length, maxFiles],
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const uploadFile = async (index: number) => {
    const uploadFile = files[index];
    if (!uploadFile) return;

    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: "uploading", progress: 0 } : f)),
    );

    try {
      // Simulate upload progress
      for (let p = 0; p <= 100; p += 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setFiles((prev) =>
          prev.map((f, i) => (i === index ? { ...f, progress: p } : f)),
        );
      }

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "complete", progress: 100 } : f,
        ),
      );
      toast.success(`Uploaded: ${uploadFile.file.name}`);
    } catch (err) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, status: "error", error: "Upload failed" }
            : f,
        ),
      );
      toast.error(`Failed to upload: ${uploadFile.file.name}`);
    }

    // Check if all uploads are complete
    const allComplete = files.every(
      (f, i) => i === index || f.status === "complete" || f.status === "error",
    );
    if (allComplete && onUploadComplete) {
      onUploadComplete();
    }
  };

  const uploadAll = async () => {
    const pending = files.filter((f) => f.status === "pending");
    for (let i = 0; i < pending.length; i++) {
      const idx = files.indexOf(pending[i]);
      if (idx >= 0) {
        await uploadFile(idx);
      }
    }
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "complete"));
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-muted"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Drag and drop files here</p>
        <p className="text-xs text-muted-foreground mt-1">
          or click to browse. Max {maxSizeMB}MB per file.
        </p>
        <input
          type="file"
          multiple
          className="hidden"
          id="document-upload-input"
          onChange={handleFileInput}
          accept={acceptedTypes.join(",")}
        />
        <label
          htmlFor="document-upload-input"
          className="inline-block mt-3 cursor-pointer"
        >
          <Button variant="outline" size="sm" asChild>
            <span>Browse Files</span>
          </Button>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((upload, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border rounded-lg bg-card"
            >
              <File className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{upload.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(upload.file.size)} · {upload.category}
                </p>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="mt-1 h-1" />
                )}
                {upload.status === "error" && (
                  <p className="text-xs text-destructive mt-1">{upload.error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {upload.status === "complete" && (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
                {upload.status === "error" && (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                {upload.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => uploadFile(index)}
                  >
                    Upload
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {files.some((f) => f.status === "pending") && (
        <Button onClick={uploadAll} className="w-full">
          Upload All Files
        </Button>
      )}
      {files.some((f) => f.status === "complete") && (
        <Button variant="outline" onClick={clearCompleted} className="w-full">
          Clear Completed
        </Button>
      )}
    </div>
  );
}
