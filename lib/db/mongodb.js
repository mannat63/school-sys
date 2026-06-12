import mongoose from "mongoose";

// Eagerly import all models to register them in serverless environments
// This prevents "Schema hasn't been registered for model" errors during .populate()
import "@/models/Attendance";
import "@/models/Class";
import "@/models/Course";
import "@/models/Fee";
import "@/models/Homework";
import "@/models/HomeworkSubmission";
import "@/models/Institute";
import "@/models/InstitutePaymentDetail";
import "@/models/Notification";
import "@/models/Parent";
import "@/models/Payment";
import "@/models/Result";
import "@/models/School";
import "@/models/Section";
import "@/models/Settings";
import "@/models/Student";
import "@/models/Subject";
import "@/models/SubjectAssignment";
import "@/models/Teacher";
import "@/models/TeacherSectionMap";
import "@/models/Test";
import "@/models/TimetableEntry";
import "@/models/User";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
