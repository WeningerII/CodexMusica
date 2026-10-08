declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    LIBRARY?: R2Bucket;
    ASSETS?: Fetcher;
    READER_BRIDGE_URL?: string;
    READER_BRIDGE_SECRET?: string;
    READER_SITE_ID?: string;
    READER_COOKIE_KEY?: string;
  }
}
