/**
 * Wave 8 — Workflow & Automation Engine
 * Assignment Engine — Coordinator/clinician assignment logic
 */

import type {
  TaskInstance,
  WorkflowInstance,
  WorkflowContext,
  Actor,
} from '../types';

export interface User {
  id: string;
  name: string;
  role: string;
  specialties: string[];
  languages: string[];
  isAvailable: boolean;
  currentWorkload: number;
  maxWorkload: number;
  patientHistory: Set<string>; // Patient refs this user has worked with
}

export interface AssignmentEngineConfig {
  users: User[];
  // Could also fetch from user service
}

export class AssignmentEngine {
  private users: Map<string, User> = new Map();

  constructor(config: AssignmentEngineConfig) {
    for (const user of config.users) {
      this.users.set(user.id, user);
    }
  }

  /**
   * Update user availability (called when user logs in/out, goes on break)
   */
  updateUserAvailability(userId: string, isAvailable: boolean): void {
    const user = this.users.get(userId);
    if (user) {
      user.isAvailable = isAvailable;
    }
  }

  /**
   * Update user workload (called when tasks are assigned/completed)
   */
  updateWorkload(userId: string, delta: number): void {
    const user = this.users.get(userId);
    if (user) {
      user.currentWorkload = Math.max(0, user.currentWorkload + delta);
    }
  }

  /**
   * Record patient history for continuity
   */
  recordPatientInteraction(userId: string, patientRef: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.patientHistory.add(patientRef);
    }
  }

  /**
   * Assign a task to the best available user
   */
  async assignTask(
    task: TaskInstance,
    workflowInstance: WorkflowInstance,
    context: WorkflowContext
  ): Promise<string | null> {
    // 1. Filter by role
    const candidates = this.filterByRole(task.assigneeRole);
    
    // 2. Filter by specialty
    const specialists = this.filterBySpecialty(candidates, task);
    
    // 3. Filter by availability
    const available = this.filterByAvailability(specialists);
    
    // 4. Filter by language (for Quebec patients)
    const languageMatched = this.filterByLanguage(available, context);
    
    // 5. Apply sticky assignment (continuity)
    const sticky = this.findStickyAssignment(languageMatched, workflowInstance.patientId);
    if (sticky) {
      this.updateWorkload(sticky.id, 1);
      this.recordPatientInteraction(sticky.id, workflowInstance.patientId);
      return sticky.id;
    }
    
    // 6. Workload balance (least busy)
    const assigned = this.assignByWorkload(languageMatched);
    if (assigned) {
      this.updateWorkload(assigned.id, 1);
      this.recordPatientInteraction(assigned.id, workflowInstance.patientId);
      return assigned.id;
    }
    
    return null;
  }

  /**
   * Filter users by role
   */
  private filterByRole(role: string): User[] {
    return Array.from(this.users.values()).filter(u => u.role === role);
  }

  /**
   * Filter users by specialty matching task requirements
   */
  private filterBySpecialty(candidates: User[], task: TaskInstance): User[] {
    // Task name or type might imply specialty
    const taskSpecialty = this.inferSpecialtyFromTask(task);
    if (!taskSpecialty) return candidates;
    
    return candidates.filter(u => u.specialties.includes(taskSpecialty));
  }

  /**
   * Infer specialty from task
   */
  private inferSpecialtyFromTask(task: TaskInstance): string | null {
    const name = task.name.toLowerCase();
    if (name.includes('monitoring') || name.includes('ultrasound') || name.includes('bloodwork')) {
      return 'nursing';
    }
    if (name.includes('protocol') || name.includes('trigger') || name.includes('transfer')) {
      return 'physician';
    }
    if (name.includes('embryo') || name.includes('fertilization') || name.includes('pgt') || name.includes('grading')) {
      return 'embryology';
    }
    if (name.includes('insurance') || name.includes('scheduling') || name.includes('authorization')) {
      return 'coordination';
    }
    if (name.includes('medication') || name.includes('pharmacy')) {
      return 'pharmacy';
    }
    return null;
  }

  /**
   * Filter by availability
   */
  private filterByAvailability(candidates: User[]): User[] {
    return candidates.filter(u => u.isAvailable && u.currentWorkload < u.maxWorkload);
  }

  /**
   * Filter by language preference
   */
  private filterByLanguage(candidates: User[], context: WorkflowContext): User[] {
    const preferredLanguage = context.language || 'en-CA';
    const langMatched = candidates.filter(u => u.languages.includes(preferredLanguage));
    return langMatched.length > 0 ? langMatched : candidates;
  }

  /**
   * Find user with patient history (sticky assignment)
   */
  private findStickyAssignment(candidates: User[], patientRef: string): User | null {
    const withHistory = candidates.filter(u => u.patientHistory.has(patientRef));
    if (withHistory.length === 0) return null;
    
    // Return least busy among those with history
    return withHistory.reduce((min, u) => 
      u.currentWorkload < min.currentWorkload ? u : min
    );
  }

  /**
   * Assign by workload balance (least busy)
   */
  private assignByWorkload(candidates: User[]): User | null {
    if (candidates.length === 0) return null;
    
    return candidates.reduce((min, u) => 
      u.currentWorkload < min.currentWorkload ? u : min
    );
  }

  /**
   * Reassign task (used for escalation, handoff)
   */
  async reassignTask(
    task: TaskInstance,
    workflowInstance: WorkflowInstance,
    context: WorkflowContext,
    excludeUserIds: string[] = []
  ): Promise<string | null> {
    // Get candidates excluding specified users
    let candidates = Array.from(this.users.values()).filter(
      u => !excludeUserIds.includes(u.id)
    );
    
    // Apply same filters
    candidates = this.filterByRole(task.assigneeRole);
    candidates = this.filterBySpecialty(candidates, task);
    candidates = this.filterByAvailability(candidates);
    candidates = this.filterByLanguage(candidates, context);
    
    // For reassignment, don't use sticky - find someone with capacity
    return this.assignByWorkload(candidates)?.id || null;
  }

  /**
   * Get workload stats for all users
   */
  getWorkloadStats(): Array<{ userId: string; name: string; role: string; current: number; max: number; capacityPct: number }> {
    return Array.from(this.users.values()).map(u => ({
      userId: u.id,
      name: u.name,
      role: u.role,
      current: u.currentWorkload,
      max: u.maxWorkload,
      capacityPct: Math.round((u.currentWorkload / u.maxWorkload) * 100),
    }));
  }

  /**
   * Get available users for a role
   */
  getAvailableUsers(role: string): User[] {
    return this.filterByAvailability(this.filterByRole(role));
  }
}

export const assignmentEngine = new AssignmentEngine({ users: [] });