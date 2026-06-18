import ActivityLog from "@/models/ActivityLog";

export async function logActivity({ institute_id, action, collection, record_id, record_label, performed_by, performed_by_name, details }) {
  try {
    await ActivityLog.create({ institute_id, action, entity: collection, record_id, record_label, performed_by, performed_by_name, details });
  } catch {
    // silent — logging failure should never break a request
  }
}
