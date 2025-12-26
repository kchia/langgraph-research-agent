import { z } from "zod";

/**
 * Type definitions for LangGraph state structure.
 *
 * These types help improve type safety when accessing graph state
 * properties like tasks, interrupts, and values.
 */

/**
 * Zod schema for an interrupt in a graph task.
 */
const GraphInterruptSchema = z.object({
  value: z.unknown()
});

/**
 * Zod schema for a task in graph state.
 */
const GraphTaskSchema = z.object({
  interrupts: z.array(GraphInterruptSchema).optional()
});

/**
 * Structure of an interrupt in a graph task.
 */
export type GraphInterrupt = z.infer<typeof GraphInterruptSchema>;

/**
 * Structure of a task in graph state.
 */
export type GraphTask = z.infer<typeof GraphTaskSchema>;

/**
 * Type guard to check if a value is a GraphTask.
 */
export function isGraphTask(value: unknown): value is GraphTask {
  return GraphTaskSchema.safeParse(value).success;
}

/**
 * Type guard to check if a value is an array of GraphTasks.
 */
export function isGraphTaskArray(value: unknown): value is GraphTask[] {
  return z.array(GraphTaskSchema).safeParse(value).success;
}

/**
 * Extract interrupt value from a task safely.
 *
 * @param task - The graph task
 * @returns The interrupt value or undefined
 */
export function getInterruptValue(task: GraphTask): unknown | undefined {
  return task.interrupts?.[0]?.value;
}

/**
 * Check if a task has interrupts.
 */
export function hasInterrupts(task: GraphTask): boolean {
  return !!task.interrupts && task.interrupts.length > 0;
}
