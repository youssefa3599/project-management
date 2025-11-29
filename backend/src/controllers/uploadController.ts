import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { logActivity } from "../utils/logActivity"; // Make sure you have this utility
import { DecodedToken } from "../middlewares/authMiddleware";

type RequestWithUser = Request & { user?: DecodedToken };

export const uploadFile = async (req: RequestWithUser, res: Response) => {
  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Create upload stream
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "uploads" },
      async (error, uploaded) => {
        if (error || !uploaded) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ message: "Upload failed", error });
        }

        // Log activity
        await logActivity({
          userId: req.user!.id,
          action: "upload_file",
          entityType: "file",
          entityId: uploaded.public_id,
          details: `File uploaded: ${uploaded.secure_url}`,
        });

        // Respond with Cloudinary info
        res.status(200).json({
          url: uploaded.secure_url,
          public_id: uploaded.public_id,
        });
      }
    );

    // Send file buffer into the stream
    if (req.file.buffer) {
      uploadStream.end(req.file.buffer);
    } else {
      return res.status(400).json({ message: "File buffer missing" });
    }
  } catch (err) {
    console.error("Server error during file upload:", err);
    res.status(500).json({ message: "Server error", err });
  }
};


