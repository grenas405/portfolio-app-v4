/** Bindings declared in wrangler.jsonc. */
export interface Env {
  readonly ASSETS: Fetcher;
  readonly CONTACT_KV: KVNamespace;
  readonly APP_VERSION: string;
}
