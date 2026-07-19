export interface StoredObject {
  key: string;
  body: ArrayBuffer | ReadableStream;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ObjectStorage {
  put(obj: StoredObject): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}
