declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    STRIDE_PASSWORD_HASH?: string;
    BUCKET?: R2Bucket;
  }
}
