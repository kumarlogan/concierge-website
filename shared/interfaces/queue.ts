export interface QueueMessage<T = unknown> {
  body: T;
  id?: string;
}

export interface Queue<T = unknown> {
  send(message: QueueMessage<T>): Promise<void>;
  /** Fan-out a batch. */
  sendBatch(messages: QueueMessage<T>[]): Promise<void>;
}
