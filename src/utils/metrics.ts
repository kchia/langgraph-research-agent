import { Logger } from "./logger.js";

const logger = new Logger("metrics");

export interface NodeMetric {
  nodeName: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
}

export interface ExecutionMetrics {
  threadId: string;
  startTime: number;
  endTime?: number;
  totalDurationMs?: number;
  nodes: NodeMetric[];
  retryCount: number;
  interrupted: boolean;
}

/**
 * Collects metrics during graph execution for observability.
 */
export class MetricsCollector {
  private execution: ExecutionMetrics | null = null;
  private currentNode: NodeMetric | null = null;

  /**
   * Start tracking a new execution.
   */
  startExecution(threadId: string): void {
    this.execution = {
      threadId,
      startTime: Date.now(),
      nodes: [],
      retryCount: 0,
      interrupted: false
    };
    logger.debug("Execution started", { threadId });
  }

  /**
   * Mark the start of a node execution.
   */
  startNode(nodeName: string): void {
    if (!this.execution) return;

    this.currentNode = {
      nodeName,
      startTime: Date.now(),
      success: false
    };
    logger.debug("Node started", { nodeName });
  }

  /**
   * Mark the end of a node execution.
   */
  endNode(success: boolean = true, errorMessage?: string): void {
    if (!this.execution || !this.currentNode) return;

    this.currentNode.endTime = Date.now();
    this.currentNode.durationMs =
      this.currentNode.endTime - this.currentNode.startTime;
    this.currentNode.success = success;
    this.currentNode.errorMessage = errorMessage;

    this.execution.nodes.push(this.currentNode);

    logger.debug("Node completed", {
      nodeName: this.currentNode.nodeName,
      durationMs: this.currentNode.durationMs,
      success
    });

    this.currentNode = null;
  }

  /**
   * Increment the retry counter.
   */
  incrementRetry(): void {
    if (this.execution) {
      this.execution.retryCount++;
    }
  }

  /**
   * Finish execution and return collected metrics.
   */
  finishExecution(interrupted: boolean = false): ExecutionMetrics | null {
    if (!this.execution) return null;

    this.execution.endTime = Date.now();
    this.execution.totalDurationMs =
      this.execution.endTime - this.execution.startTime;
    this.execution.interrupted = interrupted;

    logger.info("Execution completed", {
      threadId: this.execution.threadId,
      totalDurationMs: this.execution.totalDurationMs,
      nodeCount: this.execution.nodes.length,
      retryCount: this.execution.retryCount,
      interrupted
    });

    const result = this.execution;
    this.execution = null;
    return result;
  }

  /**
   * Get current execution metrics without finishing.
   */
  getMetrics(): ExecutionMetrics | null {
    return this.execution;
  }
}

// Global metrics instance for convenience
export const metrics = new MetricsCollector();
