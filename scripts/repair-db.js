import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function repair() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB for Repair.");

  const User = mongoose.connection.collection("users");
  const Teacher = mongoose.connection.collection("teachers");
  const Section = mongoose.connection.collection("sections");
  const Student = mongoose.connection.collection("students");
  const Fee = mongoose.connection.collection("fees");
  const Attendance = mongoose.connection.collection("attendances");
  const Test = mongoose.connection.collection("tests");
  const Result = mongoose.connection.collection("results");
  const Institute = mongoose.connection.collection("institutes");

  // Step 1: Force all collections to use a single Institute ID to avoid multi-tenant silos.
  const institutes = await Institute.find({}).sort({ _id: 1 }).toArray();
  if (institutes.length > 0) {
    const primaryInst = institutes[0]._id;
    console.log("Forcing single Institute ID:", primaryInst);
    for (const col of [User, Teacher, Section, Student, Fee, Attendance, Test, Result]) {
      await col.updateMany({}, { $set: { institute_id: primaryInst } });
    }
  }

  // Step 2: Fix Duplicate Users (Specifically the Teacher mismatch)
  // Gather all users grouped by email
  const allUsers = await User.find({}).toArray();
  const emailGroups = {};
  for (const u of allUsers) {
    const email = (u.phoneOrEmail || "").toLowerCase().trim();
    if (!email) continue;
    if (!emailGroups[email]) emailGroups[email] = [];
    emailGroups[email].push(u);
  }

  for (const [email, users] of Object.entries(emailGroups)) {
    if (users.length > 1) {
      console.log(`Found ${users.length} duplicates for email: ${email}`);
      
      // Find the user with a clerk_id (The one they actively log in with)
      const activeUser = users.find(u => u.clerk_id);
      
      // Find the user linked to a Teacher or Student record (The one created by Admin)
      const teachers = await Teacher.find({}).toArray();
      const students = await Student.find({}).toArray();
      
      let linkedUser = null;
      for (const u of users) {
        if (teachers.some(t => String(t.user_id) === String(u._id)) || 
            students.some(s => String(s.user_id) === String(u._id))) {
          linkedUser = u;
          break;
        }
      }

      if (activeUser && linkedUser && String(activeUser._id) !== String(linkedUser._id)) {
        console.log(`Mismatch detected! Active User ${activeUser._id} vs Linked User ${linkedUser._id}`);
        
        // Fix by updating the Teacher/Student to point to the Active User!
        const teacherUpdate = await Teacher.updateMany(
          { user_id: linkedUser._id },
          { $set: { user_id: activeUser._id } }
        );
        console.log(`- Updated ${teacherUpdate.modifiedCount} Teacher records to point to Active User.`);

        const studentUpdate = await Student.updateMany(
          { user_id: linkedUser._id },
          { $set: { user_id: activeUser._id } }
        );
        console.log(`- Updated ${studentUpdate.modifiedCount} Student records to point to Active User.`);

        // Now delete the Linked User since its references have been moved to Active
        await User.deleteOne({ _id: linkedUser._id });
        console.log(`- Deleted the duplicate dummy User.`);
      }
    }
  }

  // Debug Output
  console.log("\n--- Integrity Check ---");
  const mannatTeacher = await Teacher.findOne({}); 
  const mannatUser = mannatTeacher ? await User.findOne({ _id: mannatTeacher.user_id }) : null;
  console.log("Teacher Document mapped to User:", mannatUser?.phoneOrEmail, "| Clerk ID:", mannatUser?.clerk_id);
  
  const mSections = await Section.find({ teacher_id: mannatTeacher?._id }).toArray();
  console.log(`Sections assigned to this Teacher: ${mSections.length}`);
  if (mSections.length > 0) {
    const mStudents = await Student.find({ section_id: mSections[0]._id }).toArray();
    console.log(`Students assigned to Section ${mSections[0].name}: ${mStudents.length}`);
  }

  console.log("\nRepair completed.");
  process.exit();
}

repair().catch(console.error);
