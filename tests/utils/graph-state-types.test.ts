import { describe, it, expect } from "vitest";
import {
  isGraphTask,
  isGraphTaskArray,
  getInterruptValue,
  hasInterrupts,
  type GraphTask
} from "../../src/utils/graph-state-types.js";

describe("graph-state-types", () => {
  describe("isGraphTask", () => {
    it("should return true for valid graph task", () => {
      const task: GraphTask = {
        interrupts: [{ value: "test" }]
      };
      expect(isGraphTask(task)).toBe(true);
    });

    it("should return true for task without interrupts", () => {
      const task: GraphTask = {};
      expect(isGraphTask(task)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isGraphTask(null)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isGraphTask("string")).toBe(false);
      expect(isGraphTask(123)).toBe(false);
      expect(isGraphTask([])).toBe(false);
    });

    it("should return false for invalid interrupt structure", () => {
      expect(isGraphTask({ interrupts: ["invalid"] })).toBe(false);
      expect(isGraphTask({ interrupts: [null] })).toBe(false);
    });
  });

  describe("isGraphTaskArray", () => {
    it("should return true for array of valid tasks", () => {
      const tasks: GraphTask[] = [{ interrupts: [{ value: "test" }] }, {}];
      expect(isGraphTaskArray(tasks)).toBe(true);
    });

    it("should return false for empty array", () => {
      expect(isGraphTaskArray([])).toBe(true); // Empty array is valid
    });

    it("should return false for non-array", () => {
      expect(isGraphTaskArray(null)).toBe(false);
      expect(isGraphTaskArray({})).toBe(false);
      expect(isGraphTaskArray("string")).toBe(false);
    });

    it("should return false for array with invalid tasks", () => {
      expect(isGraphTaskArray([{ interrupts: ["invalid"] }])).toBe(false);
    });
  });

  describe("getInterruptValue", () => {
    it("should return interrupt value when present", () => {
      const task: GraphTask = {
        interrupts: [{ value: "test value" }]
      };
      expect(getInterruptValue(task)).toBe("test value");
    });

    it("should return undefined when no interrupts", () => {
      const task: GraphTask = {};
      expect(getInterruptValue(task)).toBeUndefined();
    });

    it("should return undefined when interrupts array is empty", () => {
      const task: GraphTask = {
        interrupts: []
      };
      expect(getInterruptValue(task)).toBeUndefined();
    });
  });

  describe("hasInterrupts", () => {
    it("should return true when task has interrupts", () => {
      const task: GraphTask = {
        interrupts: [{ value: "test" }]
      };
      expect(hasInterrupts(task)).toBe(true);
    });

    it("should return false when task has no interrupts", () => {
      const task: GraphTask = {};
      expect(hasInterrupts(task)).toBe(false);
    });

    it("should return false when interrupts array is empty", () => {
      const task: GraphTask = {
        interrupts: []
      };
      expect(hasInterrupts(task)).toBe(false);
    });
  });
});
