import ActivityLog from "../models/ActivityLog";

export const logActivity = async ({
  userId,
  action,
  entityType,
  entityId,
  details,
}: {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
}) => {
  try {
    await ActivityLog.create({ userId, action, entityType, entityId, details });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
