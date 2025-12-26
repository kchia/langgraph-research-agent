/**
 * Type definitions for LangGraph state structure.
 *
 * These types help improve type safety when accessing graph state
 * properties like tasks, interrupts, and values.
 */

/**
 * Structure of an interrupt in a graph task.
 */
export interface GraphInterrupt {
  value: unknown;
}

/**
 * Structure of a task in graph state.
 */
export interface GraphTask {
  interrupts?: GraphInterrupt[];
}

/**
 * Type guard to check if a value is a GraphTask.
 */
export function isGraphTask(value: unknown): value is GraphTask {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) && // Exclude arrays
    (!("interrupts" in value) ||
      (Array.isArray((value as GraphTask).interrupts) &&
        (value as GraphTask).interrupts!.every(
          (i) => typeof i === "object" && i !== null && "value" in i
        )))
  );
}

/**
 * Type guard to check if a value is an array of GraphTasks.
 */
export function isGraphTaskArray(value: unknown): value is GraphTask[] {
  return Array.isArray(value) && value.every(isGraphTask);
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
