import mongoose from "mongoose";

// Load models
import User from "../models/User.js";
import Institute from "../models/Institute.js";
import Course from "../models/Course.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Fee from "../models/Fee.js";
import Attendance from "../models/Attendance.js";
import Test from "../models/Test.js";
import Result from "../models/Result.js";
import Subject from "../models/Subject.js";

const MONGODB_URI = process.env.MONGODB_URI;

async function seed() {
  if (!MONGODB_URI) {
    console.error("Set MONGODB_URI env variable first!");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  // Clean existing data
  await Promise.all([
    User.deleteMany({}),
    Institute.deleteMany({}),
    Course.deleteMany({}),
    Section.deleteMany({}),
    Student.deleteMany({}),
    Teacher.deleteMany({}),
    Fee.deleteMany({}),
    Attendance.deleteMany({}),
    Test.deleteMany({}),
    Result.deleteMany({}),
    Subject.deleteMany({}),
  ]);
  console.log("Cleared old data");

  // 1. Institute
  const institute = await Institute.create({
    name: "Bright Future Coaching",
    owner_name: "Rajesh Kumar",
    phone: "+919876543210",
  });

  // 2. Users (clerk_id placeholders — update after Clerk sign-up)
  const adminUser = await User.create({
    name: "Rajesh Kumar",
    phoneOrEmail: "admin@test.com",
    role: "ADMIN",
    institute_id: institute._id,
    clerk_id: "CLERK_ADMIN_ID_PLACEHOLDER",
  });

  const teacherUser = await User.create({
    name: "Priya Sharma",
    phoneOrEmail: "teacher@test.com",
    role: "TEACHER",
    institute_id: institute._id,
    clerk_id: "CLERK_TEACHER_ID_PLACEHOLDER",
  });

  const studentUser = await User.create({
    name: "Aarav Patel",
    phoneOrEmail: "student@test.com",
    role: "STUDENT",
    institute_id: institute._id,
    clerk_id: "CLERK_STUDENT_ID_PLACEHOLDER",
  });

  // 3. Subjects
  const subjectPhy = await Subject.create({ name: "Physics", institute_id: institute._id });
  const subjectMath = await Subject.create({ name: "Mathematics", institute_id: institute._id });

  // 4. Teacher profile
  const teacher = await Teacher.create({
    user_id: teacherUser._id,
    institute_id: institute._id,
    subjects: [subjectPhy._id, subjectMath._id]
  });

  // 5. Courses
  const courseJEE = await Course.create({ name: "JEE Preparation", institute_id: institute._id });
  const course10 = await Course.create({ name: "10th Board", institute_id: institute._id });

  // 6. Sections
  const sectionJEE = await Section.create({
    name: "JEE Morning",
    course_id: courseJEE._id,
    teacher_id: teacher._id,
    timing: "8:00 AM - 10:00 AM",
    institute_id: institute._id,
  });

  const section10 = await Section.create({
    name: "10th Evening",
    course_id: course10._id,
    teacher_id: teacher._id,
    timing: "4:00 PM - 6:00 PM",
    institute_id: institute._id,
  });

  // 7. Students (5 total)
  const studentNames = [
    { name: "Aarav Patel", phone: "student@test.com", parent: "Suresh Patel", parentPhone: "+919111111111", section: sectionJEE._id, userId: studentUser._id },
    { name: "Diya Singh", phone: "diya@test.com", parent: "Ramesh Singh", parentPhone: "+919222222222", section: sectionJEE._id, userId: null },
    { name: "Vihaan Gupta", phone: "vihaan@test.com", parent: "Anil Gupta", parentPhone: "+919333333333", section: sectionJEE._id, userId: null },
    { name: "Ananya Rao", phone: "ananya@test.com", parent: "Kiran Rao", parentPhone: "+919444444444", section: section10._id, userId: null },
    { name: "Rohan Verma", phone: "rohan@test.com", parent: "Deepak Verma", parentPhone: "+919555555555", section: section10._id, userId: null },
  ];

  const students = [];
  for (const s of studentNames) {
    let uid = s.userId;
    if (!uid) {
      const u = await User.create({
        name: s.name,
        phoneOrEmail: s.phone,
        role: "STUDENT",
        institute_id: institute._id,
      });
      uid = u._id;
    }
    const student = await Student.create({
      user_id: uid,
      section_id: s.section,
      parent_name: s.parent,
      parent_phone: s.parentPhone,
      institute_id: institute._id,
    });
    students.push(student);
  }

  // 8. Fees
  const today = new Date();
  const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  for (let i = 0; i < students.length; i++) {
    const paid = i < 2 ? 5000 : i < 4 ? 2000 : 0;
    await Fee.create({
      student_id: students[i]._id,
      total_amount: 5000,
      paid_amount: paid,
      due_amount: 5000 - paid,
      due_date: dueDate,
      status: paid >= 5000 ? "PAID" : paid > 0 ? "PARTIAL" : "DUE",
      institute_id: institute._id,
    });
  }

  // 9. Attendance (last 3 days)
  for (let d = 1; d <= 3; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    for (const student of students) {
      await Attendance.create({
        student_id: student._id,
        section_id: student.section_id,
        date,
        status: Math.random() > 0.2 ? "PRESENT" : "ABSENT",
        institute_id: institute._id,
      });
    }
  }

  // 10. Test + Results
  const test = await Test.create({
    name: "Mid-Term Physics",
    section_id: sectionJEE._id,
    date: new Date(),
    total_marks: 100,
    institute_id: institute._id,
  });

  const jeeStudents = students.filter((s) => s.section_id.toString() === sectionJEE._id.toString());
  for (const student of jeeStudents) {
    await Result.create({
      test_id: test._id,
      student_id: student._id,
      marks: Math.floor(Math.random() * 40 + 60),
      institute_id: institute._id,
    });
  }

  console.log("✅ Seed complete!");
  console.log(`   Institute: ${institute.name} (${institute._id})`);
  console.log(`   Admin clerk_id placeholder: CLERK_ADMIN_ID_PLACEHOLDER`);
  console.log(`   Teacher clerk_id placeholder: CLERK_TEACHER_ID_PLACEHOLDER`);
  console.log(`   Student clerk_id placeholder: CLERK_STUDENT_ID_PLACEHOLDER`);
  console.log("\n⚠️  Update the clerk_id values in the users collection with your actual Clerk user IDs!");

  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
