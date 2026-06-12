/**
 * n8n Webhook Service
 *
 * Sends automation events to an n8n workflow via HTTP POST.
 * Set N8N_WEBHOOK_URL in your .env.local to enable automations.
 * If the env var is missing, the function logs a warning and returns silently.
 */

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

/**
 * Sends a structured event payload to the configured n8n webhook.
 *
 * @param {Object} payload - The event data to send.
 * @param {string} payload.event_type - e.g. "fee_reminder", "homework_assigned"
 * @param {string} payload.timestamp  - ISO 8601 timestamp
 * @param {Object} payload.institute  - { id, name }
 * @param {Object} payload.student    - { id, name, parent_phone, section_name }
 * @param {Object} payload.data       - Event-specific data
 */
export async function sendEventToN8N(payload) {
  if (!N8N_WEBHOOK_URL) {
    console.warn(
      "[n8n] N8N_WEBHOOK_URL is not set — skipping webhook dispatch for event:",
      payload?.event_type
    );
    return;
  }

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `n8n webhook returned ${response.status}: ${text}`
    );
  }

  return response;
}
