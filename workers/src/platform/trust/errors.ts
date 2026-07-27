// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Trust Runtime Error Classes                      │
// │ Wave 4 — AI Platform Trust Runtime v1                                │
// └─────────────────────────────────────────────────────────────┘

export class TrustEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "TrustEngineError";
  }
}

export class PolicyEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "PolicyEngineError";
  }
}

export class ConsentEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ConsentEngineError";
  }
}

export class DelegationEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "DelegationEngineError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class RiskEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "RiskEngineError";
  }
}