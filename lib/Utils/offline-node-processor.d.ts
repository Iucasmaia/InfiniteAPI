import type { BinaryNode } from '../WABinary/index.js';
export type MessageType = 'message' | 'call' | 'receipt' | 'notification';
export type OfflineNodeProcessorDeps = {
    isWsOpen: () => boolean;
    onUnexpectedError: (error: Error, msg: string) => void;
    yieldToEventLoop: () => Promise<void>;
};
/**
 * Creates a processor for offline stanza nodes that:
 * - Queues nodes for sequential processing
 * - Yields to the event loop periodically to avoid blocking
 * - Catches handler errors to prevent the processing loop from crashing
 *
 * NOTE: InfiniteAPI uses batchSize=25 (vs upstream default 10) — a deliberate
 * tuning from PR #239 (3d9d7baf) that reduces event-loop yields per second
 * during offline drain. Do NOT lower it without re-benchmarking.
 */
export declare function makeOfflineNodeProcessor(nodeProcessorMap: Map<MessageType, (node: BinaryNode) => Promise<void>>, deps: OfflineNodeProcessorDeps, batchSize?: number): {
    enqueue: (type: MessageType, node: BinaryNode) => void;
};
//# sourceMappingURL=offline-node-processor.d.ts.map