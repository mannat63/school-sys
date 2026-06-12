import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import Notification from "@/models/Notification";

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    
    // Create new custom notification
    const { message, type } = await req.json();

    if (!message || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const notification = await Notification.create({
      institute_id: authUser.institute_id,
      title: "System Alert",
      message: message,
      type: type,
    });

    return NextResponse.json({ success: true, notification }, { status: 201 });
  } catch (error) {
    console.error("Custom Notification Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
