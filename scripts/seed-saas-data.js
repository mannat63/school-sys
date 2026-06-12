const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

// ── Inline schemas ────────────────────────────────────────────────────────────
const InstituteSchema = new mongoose.Schema({ name: String, owner_name: String, phone: String });
const UserSchema = new mongoose.Schema({
  name: String,
  phoneOrEmail: String,  // email used here for Google login
  role: String,
  institute_id: mongoose.Schema.Types.ObjectId,
});
const ClassSchema = new mongoose.Schema({
  name: String,
  institute_id: mongoose.Schema.Types.ObjectId,
});
const SubjectSchema = new mongoose.Schema({
  name: String,
  institute_id: mongoose.Schema.Types.ObjectId,
});
const TeacherSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  institute_id: mongoose.Schema.Types.ObjectId,
  subjects: [mongoose.Schema.Types.ObjectId],
});
const SectionSchema = new mongoose.Schema({
  name: String,
  class_id: mongoose.Schema.Types.ObjectId,
  course_id: mongoose.Schema.Types.ObjectId,
  teacher_id: mongoose.Schema.Types.ObjectId,
  timing: String,
  institute_id: mongoose.Schema.Types.ObjectId,
});
const StudentSchema = new mongoose.Schema({
  user_id: mongoose.Schema.Types.ObjectId,
  section_id: mongoose.Schema.Types.ObjectId,
  parent_name: String,
  parent_phone: String,
  admission_date: Date,
  institute_id: mongoose.Schema.Types.ObjectId,
});
const FeeSchema = new mongoose.Schema({
  student_id: mongoose.Schema.Types.ObjectId,
  total_amount: Number,
  paid_amount: { type: Number, default: 0 },
  due_amount: Number,
  due_date: Date,
  status: { type: String, default: "DUE" },
  institute_id: mongoose.Schema.Types.ObjectId,
});
const AttendanceSchema = new mongoose.Schema({
  student_id: mongoose.Schema.Types.ObjectId,
  section_id: mongoose.Schema.Types.ObjectId,
  date: Date,
  status: String,
  institute_id: mongoose.Schema.Types.ObjectId,
});
AttendanceSchema.index({ student_id: 1, section_id: 1, date: 1 }, { unique: true });

const TestSchema = new mongoose.Schema({
  name: String,
  section_id: mongoose.Schema.Types.ObjectId,
  date: Date,
  subjects: [{ name: String, max_marks: Number }],
  total_marks: Number,
  institute_id: mongoose.Schema.Types.ObjectId,
});
const ResultSchema = new mongoose.Schema({
  test_id: mongoose.Schema.Types.ObjectId,
  student_id: mongoose.Schema.Types.ObjectId,
  subject_marks: [{ subject: String, marks: Number }],
  marks: Number,
  institute_id: mongoose.Schema.Types.ObjectId,
});
const CourseSchema = new mongoose.Schema({
  name: String,
  institute_id: mongoose.Schema.Types.ObjectId,
});

const Institute = mongoose.model("Institute", InstituteSchema);
const User = mongoose.model("User", UserSchema);
const Class = mongoose.model("Class", ClassSchema);
const Subject = mongoose.model("Subject", SubjectSchema);
const Teacher = mongoose.model("Teacher", TeacherSchema);
const Section = mongoose.model("Section", SectionSchema);
const Student = mongoose.model("Student", StudentSchema);
const Fee = mongoose.model("Fee", FeeSchema);
const Attendance = mongoose.model("Attendance", AttendanceSchema);
const Test = mongoose.model("Test", TestSchema);
const Result = mongoose.model("Result", ResultSchema);
const Course = mongoose.model("Course", CourseSchema);

// ── Indian data ───────────────────────────────────────────────────────────────
const TEACHER_DATA = [
  { name: "Suresh Sharma", email: "suresh.sharma@school.in", parentName: "Ramesh Sharma" },
  { name: "Priya Mehta", email: "priya.mehta@school.in", parentName: "Vijay Mehta" },
  { name: "Amit Verma", email: "amit.verma@school.in", parentName: "Rakesh Verma" },
  { name: "Neha Gupta", email: "neha.gupta@school.in", parentName: "Anil Gupta" },
  { name: "Rajesh Kumar", email: "rajesh.kumar@school.in", parentName: "Mohan Kumar" },
];

const FIRST_NAMES = ["Aarav", "Diya", "Vihaan", "Ananya", "Arjun", "Kavya", "Rohan", "Ishaan", "Tanvi", "Siddharth", "Meera", "Kabir", "Pooja", "Yash", "Riya", "Arnav", "Shruti", "Dev", "Nidhi", "Kunal", "Rahul", "Priya", "Aditya", "Neha", "Karan", "Sneha", "Vikram", "Tara", "Rishabh", "Nisha", "Sameer", "Simran", "Varun", "Isha", "Ravi", "Geeta", "Ajay", "Kiran", "Sanjay", "Ritu"];
const LAST_NAMES = ["Patel", "Singh", "Sharma", "Rao", "Mishra", "Nair", "Joshi", "Gupta", "Reddy", "Verma", "Iyer", "Khan", "Singhania", "Dubey", "Agarwal", "Bose", "Pillai", "Malhotra", "Saxena", "Bhatt", "Chauhan", "Deshmukh", "Mehta", "Chopra", "Kapoor"];

// Generate 40 Indian students dynamically
const STUDENT_DATA = Array.from({ length: 40 }, (_, i) => {
  const fName = FIRST_NAMES[i % FIRST_NAMES.length];
  const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { 
    name: `${fName} ${lName}`, 
    email: `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@student.in`, 
    parent: `Mr. ${lName}`, 
    phone: `+9198100${i.toString().padStart(5, '0')}` 
  };
});

const SUBJECTS_LIST = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "History", "Geography", "Computer Science"];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not found in .env.local");

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log("✅ Connected to MongoDB");

  // Clear everything
  await Promise.all([
    Institute.deleteMany(), User.deleteMany(), Class.deleteMany(), Subject.deleteMany(),
    Teacher.deleteMany(), Section.deleteMany(), Student.deleteMany(),
    Fee.deleteMany(), Attendance.deleteMany(), Test.deleteMany(), Result.deleteMany(), Course.deleteMany(),
  ]);
  console.log("🗑️  Cleared all collections");

  // ── Institute ──────────────────────────────────────────────────────────────
  const inst = await Institute.create({
    name: "Vidya Mandir School",
    owner_name: "Principal Sharma",
    phone: "+919800000001",
  });
  const IID = inst._id;
  console.log(`🏫 Institute: ${inst.name}`);

  // ── Admin user ─────────────────────────────────────────────────────────────
  await User.create({
    name: "Principal Sharma",
    phoneOrEmail: "coachman9606@gmail.com",
    role: "ADMIN",
    institute_id: IID,
  });

  // ── Subjects ───────────────────────────────────────────────────────────────
  const insertedSubjects = await Subject.insertMany(
    SUBJECTS_LIST.map((name) => ({ name, institute_id: IID }))
  );
  const subMap = {};
  insertedSubjects.forEach((s) => { subMap[s.name] = s._id; });
  console.log(`📚 Created ${insertedSubjects.length} subjects`);

  // ── A placeholder Course (required by Section schema) ─────────────────────
  const placeholderCourse = await Course.create({ name: "General", institute_id: IID });

  // ── Teachers ───────────────────────────────────────────────────────────────
  const teacherSubjectGroups = [
    ["Mathematics", "Physics"],
    ["Chemistry", "Biology"],
    ["English", "History"],
    ["Geography", "Computer Science"],
    ["Mathematics", "Computer Science"],
  ];

  const insertedTeachers = [];
  for (let i = 0; i < TEACHER_DATA.length; i++) {
    const td = TEACHER_DATA[i];
    const user = await User.create({
      name: td.name,
      phoneOrEmail: td.email,
      role: "TEACHER",
      institute_id: IID,
    });
    const subIds = teacherSubjectGroups[i].map((n) => subMap[n]).filter(Boolean);
    const t = await Teacher.create({ user_id: user._id, institute_id: IID, subjects: subIds });
    insertedTeachers.push(t);
  }
  console.log(`👩‍🏫 Created ${insertedTeachers.length} teachers`);

  // ── Classes (8 to 12) ──────────────────────────────────────────────────────
  const classDefs = [8, 9, 10, 11, 12].map(i => ({ name: `Class ${i}`, institute_id: IID }));
  const insertedClasses = await Class.insertMany(classDefs);
  const classMap = {};
  insertedClasses.forEach((c) => { classMap[c.name] = c._id; });
  console.log("🏫 Created Class 8 to 12");

  // ── Sections (Random 1 to 3 for each class) ───────────────────────────────
  const secNames = ["A", "B", "C"];
  const insertedSections = [];
  for (let i = 8; i <= 12; i++) {
    const numSections = Math.floor(Math.random() * 3) + 1; // 1 to 3
    for (let j = 0; j < numSections; j++) {
      const className = `Class ${i}`;
      const secName = secNames[j];
      const sec = await Section.create({
        name: secName,
        class_id: classMap[className],
        course_id: placeholderCourse._id, // Legacy compatibility if any checks exist
        institute_id: IID,
      });
      insertedSections.push({ ...sec.toObject(), _className: className, _secName: secName });
    }
  }
  console.log(`📂 Created ${insertedSections.length} sections dynamically`);

  // ── Students ───────────────────────────────────────────────────────────────
  const today = new Date();
  const insertedStudents = [];
  let currentSectionIdx = 0;

  for (let i = 0; i < STUDENT_DATA.length; i++) {
    const sd = STUDENT_DATA[i];
    const user = await User.create({
      name: sd.name,
      phoneOrEmail: sd.email,           
      role: "STUDENT",
      institute_id: IID,
    });
    
    // Distribute evenly across all available sections
    const assignSection = insertedSections[currentSectionIdx];
    currentSectionIdx = (currentSectionIdx + 1) % insertedSections.length;
    
    // Vary admission date (randomly up to 4 months ago)
    const admDate = new Date(today.getTime() - Math.floor(Math.random() * 120) * 24 * 60 * 60 * 1000);
    
    const student = await Student.create({
      user_id: user._id,
      section_id: assignSection._id,
      parent_name: sd.parent,
      parent_phone: sd.phone,
      admission_date: admDate,
      institute_id: IID,
    });
    insertedStudents.push({ ...student.toObject(), _class: assignSection._className, _sec: assignSection._secName, _adm: admDate });
  }
  console.log(`🎓 Created ${insertedStudents.length} students`);

  // ── Fees ───────────────────────────────────────────────────────────────────
  for (let i = 0; i < insertedStudents.length; i++) {
    const studentData = insertedStudents[i];
    const total = 12000;
    
    // Fee due exactly 1 month from admission date
    let feeDueDate = new Date(studentData._adm);
    feeDueDate.setMonth(feeDueDate.getMonth() + 1);

    // Randomize whether they paid or not
    const rand = Math.random();
    let paid = total;
    if (rand < 0.25) paid = 0;
    else if (rand < 0.40) paid = 6000;
    
    await Fee.create({
      student_id: studentData._id,
      total_amount: total,
      paid_amount: paid,
      due_amount: total - paid,
      due_date: feeDueDate,
      status: paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "DUE",
      institute_id: IID,
    });
  }
  console.log("💰 Created fee records tied to admission dates");

  // ── Attendance (last 10 school days) ──────────────────────────────────────
  const attendanceDocs = [];
  for (let d = 1; d <= 10; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    if (date.getDay() === 0) continue; // skip Sundays
    for (const st of insertedStudents) {
      attendanceDocs.push({
        student_id: st._id,
        section_id: st.section_id,
        date,
        status: Math.random() > 0.15 ? "PRESENT" : "ABSENT",
        institute_id: IID,
      });
    }
  }
  await Attendance.insertMany(attendanceDocs);
  console.log(`📅 Created ${attendanceDocs.length} attendance records`);

  // ── Tests & Results ────────────────────────────────────────────────────────
  for (const sec of insertedSections) {
    const testSubjects = [
      { name: "Mathematics", max_marks: 100 },
      { name: "Physics", max_marks: 100 },
      { name: "Chemistry", max_marks: 100 },
    ];
    const test = await Test.create({
      name: "Unit Test 1",
      section_id: sec._id,
      date: new Date(today.getTime() - 7 * 86400000),
      subjects: testSubjects,
      total_marks: 300,
      institute_id: IID,
    });

    const secStudents = insertedStudents.filter((s) => s.section_id.toString() === sec._id.toString());
    for (const st of secStudents) {
      const subject_marks = testSubjects.map((sub) => ({
        subject: sub.name,
        marks: Math.floor(Math.random() * 40 + 55), // 55–95
      }));
      const total = subject_marks.reduce((s, m) => s + m.marks, 0);
      await Result.create({
        test_id: test._id,
        student_id: st._id,
        subject_marks,
        marks: total,
        institute_id: IID,
      });
    }
  }
  console.log("📝 Created tests & results");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n🎉 Seed complete!\n");
  console.log(`   Institute: ${inst.name}`);
  console.log(`   Admin login: coachman9606@gmail.com`);
  console.log(`   Teachers: ${TEACHER_DATA.map(t => t.email).join(", ")}`);
  console.log(`   Students: ${STUDENT_DATA.length} Indian students evenly distributed`);
  console.log(`   Classes: Class 8 to Class 12 (${insertedSections.length} Sections total)`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
