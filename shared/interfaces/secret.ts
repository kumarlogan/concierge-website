export interface SecretProvider {
  /** Read a secret by name. Throws if missing (never returns undefined silently). */
  get(name: string): Promise<string>;
  /** List secret names (values never returned). */
  list(): Promise<string[]>;
}
