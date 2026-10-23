/**
 * What `POST /api/purchases` returns: the bought work, delivered once.
 * `content_body` is plain text (never base64; HTML already sanitized) for
 * markdown, brokered and inline html; `content_uri` (http/https only) for
 * works hosted elsewhere.
 */
export interface Delivery {
  content_type: string
  content_body?: string
  content_uri?: string
}

