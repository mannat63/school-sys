import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function consolidate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected...");

  const User = mongoose.connection.collection("users");
  const Institute = mongoose.connection.collection("institutes");
  const Teacher = mongoose.connection.collection("teachers");
  const Section = mongoose.connection.collection("sections");
  const Student = mongoose.connection.collection("students");
  const Fee = mongoose.connection.collection("fees");
  const Attendance = mongoose.connection.collection("attendances");
  const Test = mongoose.connection.collection("tests");
  const Result = mongoose.connection.collection("results");

  const institutes = await Institute.find({}).sort({ _id: 1 }).toArray();
  if (institutes.length === 0) return process.exit();
  const primaryInst = institutes[0]._id;
  console.log("Primary Institute ID:", primaryInst);

  for (const col of [User, Teacher, Section, Student, Fee, Attendance, Test, Result]) {
    await col.updateMany({}, { $set: { institute_id: primaryInst } });
  }

  const mannatUsers = await User.find({ phoneOrEmail: /mannat/i }).sort({ createdAt: 1 }).toArray();
  if (mannatUsers.length > 1) {
    const teachers = await Teacher.find({}).toArray();
    let correctUser = null;
    let wrongUser = null;
    
    for (const u of mannatUsers) {
      if (teachers.some(t => String(t.user_id) === String(u._id))) {
        correctUser = u;
      } else {
        wrongUser = u;
      }
    }

    if (correctUser && wrongUser) {
      console.log('Found correct User linked to Teacher:', correctUser._id);
      
      const wrongClerkId = wrongUser.clerk_id;
      await User.updateOne({ _id: correctUser._id }, { $set: { clerk_id: wrongClerkId } });
      await User.deleteOne({ _id: wrongUser._id });
      console.log('Merged Teacher profile and deleted duplicate.');
    }
  }

  console.log("Consolidation done.");
  process.exit();
}

consolidate().catch(console.error);
