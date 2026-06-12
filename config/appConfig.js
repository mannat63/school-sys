// ============================================================
// APP CONFIGURATION
// UPDATE THIS FILE TO CHANGE ROLES, FEATURES, OR SETTINGS
// ============================================================

// TODO: Replace hardcoded role logic with DB-based roles
export const ROLE_MAP = {
  "coachman9606@gmail.com": "ADMIN",
  "teamintellogy@gmail.com": "ADMIN",
  "mannatgoyal27102005@gmail.com": "TEACHER",
  "campervictor52@gmail.com": "STUDENT",
  "hackareg07@gmail.com": "STUDENT",
};

// Default role for emails not in ROLE_MAP
export const DEFAULT_ROLE = "STUDENT";

// Institute name used when auto-provisioning
export const INSTITUTE_NAME = "Alpha School";

// Feature toggles (defaults — can be overridden per-institute in DB)
export const FEATURES = {
  feeReminders: true,
  attendanceAlerts: true,
  csvImport: true,
};

// Webhook URL for n8n automation
export const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "";
