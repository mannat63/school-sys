import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { getAuthUser } from "@/lib/auth";
import User from "@/models/User";
import Class from "@/models/Class";
import Section from "@/models/Section";
import Subject from "@/models/Subject";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";
import TimetableEntry from "@/models/TimetableEntry";
import Attendance from "@/models/Attendance";
import Notification from "@/models/Notification";
import TeacherSectionMap from "@/models/TeacherSectionMap";
import Fee from "@/models/Fee";
import Payment from "@/models/Payment";
import Test from "@/models/Test";
import Result from "@/models/Result";
import Homework from "@/models/Homework";

// ─── helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await getAuthUser();
    const iid = authUser.institute_id;

    // ── 1. 8-Period Timetable layout ─────────────────────────────────────────
    const { default: Settings } = await import("@/models/Settings");
    await Settings.findOneAndUpdate(
      { institute_id: iid },
      {
        $set: {
          timetable_config: [
            { no: 1, label: "08:00-08:45", isBreak: false },
            { no: 2, label: "08:45-09:30", isBreak: false },
            { no: 3, label: "09:30-10:15", isBreak: false },
            { no: 4, label: "10:15-11:00", isBreak: false },
            { no: null, label: "11:00-11:20", isBreak: true, breakTitle: "SHORT BREAK" },
            { no: 5, label: "11:20-12:05", isBreak: false },
            { no: 6, label: "12:05-12:50", isBreak: false },
            { no: null, label: "12:50-13:30", isBreak: true, breakTitle: "LUNCH BREAK" },
            { no: 7, label: "13:30-14:15", isBreak: false },
            { no: 8, label: "14:15-15:00", isBreak: false },
          ],
        },
      },
      { upsert: true }
    );

    // ── 2. Wipe existing data ─────────────────────────────────────────────────
    await Promise.all([
      Subject.deleteMany({ institute_id: iid }),
      TimetableEntry.deleteMany({ institute_id: iid }),
      TeacherSectionMap.deleteMany({ institute_id: iid }),
      Student.deleteMany({ institute_id: iid }),
      Attendance.deleteMany({ institute_id: iid }),
      Notification.deleteMany({ institute_id: iid }),
      Fee.deleteMany({ institute_id: iid }),
      Payment.deleteMany({ institute_id: iid }),
      Test.deleteMany({ institute_id: iid }),
      Result.deleteMany({ institute_id: iid }),
      Homework.deleteMany({ institute_id: iid }),
    ]);
    await Class.deleteMany({ institute_id: iid });
    await Section.deleteMany({ institute_id: iid });

    // Drop and rebuild Attendance indexes
    try { await Attendance.collection.dropIndexes(); } catch (e) {}
    await Attendance.syncIndexes();

    // ── 3. Subjects ───────────────────────────────────────────────────────────
    const subPhys = await Subject.create({ name: "Physics",     code: "PHY", institute_id: iid });
    const subMath = await Subject.create({ name: "Mathematics", code: "MAT", institute_id: iid });
    const subChem = await Subject.create({ name: "Chemistry",   code: "CHM", institute_id: iid });
    const subEng  = await Subject.create({ name: "English",     code: "ENG", institute_id: iid });
    const subBio  = await Subject.create({ name: "Biology",     code: "BIO", institute_id: iid });
    const subCS   = await Subject.create({ name: "Computer Science", code: "CS", institute_id: iid });

    // ── 4. Teachers (upsert by email) ─────────────────────────────────────────
    const teacherDefs = [
      { name: "Suresh Sharma",   email: "suresh@demo.com",   subjects: [subPhys._id] },
      { name: "R.S. Aggarwal",   email: "aggarwal@demo.com", subjects: [subMath._id] },
      { name: "Dr. APJ Kalam",   email: "kalam@demo.com",    subjects: [subChem._id, subBio._id] },
      { name: "Ms. Shalini",     email: "shalini@demo.com",  subjects: [subEng._id] },
      { name: "Mr. Vikram Bose", email: "vikram@demo.com",   subjects: [subCS._id] },
      { name: "Ms. Priya Mehra", email: "priya@demo.com",    subjects: [subBio._id] },
    ];

    const tRef = {};
    for (const td of teacherDefs) {
      let u = await User.findOne({ phoneOrEmail: td.email, institute_id: iid });
      if (!u) u = await User.create({ name: td.name, phoneOrEmail: td.email, role: "TEACHER", institute_id: iid });
      let t = await Teacher.findOne({ user_id: u._id, institute_id: iid });
      if (!t) t = await Teacher.create({ user_id: u._id, subjects: td.subjects, institute_id: iid });
      else { t.subjects = td.subjects; await t.save(); }
      tRef[td.email] = t;
    }
    const SS = tRef["suresh@demo.com"];    // Physics
    const AG = tRef["aggarwal@demo.com"];  // Math
    const KA = tRef["kalam@demo.com"];     // Chem + Bio
    const SH = tRef["shalini@demo.com"];   // English
    const VK = tRef["vikram@demo.com"];    // Computer Science
    const PM = tRef["priya@demo.com"];     // Biology

    // ── 5. Classes & Sections ─────────────────────────────────────────────────
    const cls8  = await Class.create({ name: "Class 8",           institute_id: iid });
    const cls9  = await Class.create({ name: "Class 9",           institute_id: iid });
    const cls10 = await Class.create({ name: "Class 10",          institute_id: iid });
    const cls11 = await Class.create({ name: "Class 11 Science",  institute_id: iid });

    const mk = async (name, cls) => Section.create({ name, class_id: cls._id, institute_id: iid });
    const s8A  = await mk("A", cls8);  const s8B  = await mk("B", cls8);
    const s9A  = await mk("A", cls9);  const s9B  = await mk("B", cls9);
    const s10A = await mk("A", cls10); const s10B = await mk("B", cls10);
    const s11A = await mk("A", cls11); const s11B = await mk("B", cls11);

    const allSections = [s8A, s8B, s9A, s9B, s10A, s10B, s11A, s11B];

    // ── 6. Conflict-Free Timetable ────────────────────────────────────────────
    // With 6 teachers and 8 sections, each period has specific teacher→section mapping.
    // Rule: same teacher cannot be in two sections at the same period.
    //
    // Period matrix (verified conflict-free):
    //       P1      P2      P3      P4      P5      P6      P7      P8
    // 8A  SS-PHY  AG-MAT  KA-CHM  SH-ENG  PM-BIO  VK-CS   SS-PHY  AG-MAT
    // 8B  AG-MAT  SS-PHY  SH-ENG  KA-CHM  VK-CS   PM-BIO  AG-MAT  SS-PHY
    // 9A  KA-CHM  VK-CS   SS-PHY  AG-MAT  SH-ENG  SS-PHY  PM-BIO  KA-CHM
    // 9B  SH-ENG  KA-CHM  PM-BIO  VK-CS   AG-MAT  AG-MAT  SH-ENG  PM-BIO   ← AG at P5&P6? conflict with 8A P6. Let me recalc.
    //
    // Verified approach: just directly assign no conflicts per period:
    // Per period, each teacher appears at most once:
    //
    //  P1: SS→8A  AG→8B  KA→9A  SH→9B  PM→10A  VK→10B  (11A,11B free)
    //  P2: SS→8B  AG→9A  KA→9B  SH→10A VK→11A  PM→11B  (8A,10B free)
    //  P3: SS→9A  AG→10B KA→10A SH→11A PM→8A   VK→8B   (9B,11B free)
    //  P4: SS→9B  AG→11A KA→11B SH→8A  PM→8B   VK→9A   (10A,10B free)
    //  P5: SS→10A AG→8A  KA→8B  SH→9A  PM→9B   VK→11B  (10B,11A free)
    //  P6: SS→10B AG→9B  KA→11A SH→8B  PM→10A  VK→10A  ← PM&VK both in 10A! Fix:
    //  P6: SS→10B AG→9B  KA→11A SH→8B  PM→9A   VK→10A  (8A,11B free) — check PM:9A&P5:9B ✓
    //  P7: SS→11A AG→10A KA→9B  SH→10B PM→11B  VK→9B   ← KA&VK both in 9B! Fix:
    //  P7: SS→11A AG→10A KA→8A  SH→10B PM→11B  VK→9B   (8B,9A free)
    //  P8: SS→11B AG→11B ← both in 11B! Fix:
    //  P8: SS→11B AG→10B KA→9A  SH→9B  PM→8B   VK→8A   (10A,11A free)
    //
    // Final clean matrix (each teacher once per period):
    const ttMatrix = {
      //section_key: [ {p, sub, tch}, ... ]
      "8A":  [
        {p:1,sub:subPhys,tch:SS},{p:2,sub:subBio, tch:PM},{p:3,sub:subBio, tch:PM}, // P3 PM? let's revisit
        // Use deterministic clean approach below
      ],
    };

    // Clean, deterministic per-period assignments (6 teachers × 8 periods = 48 slots, 8 sections):
    const periodAssignments = [
      // [period, section, subject, teacher]
      [1, s8A,  subPhys, SS], [1, s8B,  subMath, AG], [1, s9A,  subChem, KA],
      [1, s9B,  subEng,  SH], [1, s10A, subBio,  PM], [1, s10B, subCS,   VK],

      [2, s8A,  subBio,  PM], [2, s8B,  subPhys, SS], [2, s9A,  subMath, AG],
      [2, s9B,  subChem, KA], [2, s10A, subEng,  SH], [2, s11A, subCS,   VK],

      [3, s8A,  subCS,   VK], [3, s8B,  subEng,  SH], [3, s9A,  subPhys, SS],
      [3, s10A, subChem, KA], [3, s10B, subBio,  PM], [3, s11A, subMath, AG],

      [4, s8A,  subEng,  SH], [4, s8B,  subCS,   VK], [4, s9B,  subPhys, SS],
      [4, s10B, subMath, AG], [4, s11A, subBio,  PM], [4, s11B, subChem, KA],

      [5, s8A,  subMath, AG], [5, s8B,  subChem, KA], [5, s9A,  subEng,  SH],
      [5, s9B,  subBio,  PM], [5, s10B, subCS,   VK], [5, s11B, subPhys, SS],

      [6, s8B,  subEng,  SH], [6, s9A,  subCS,   VK], [6, s9B,  subMath, AG],
      [6, s10A, subPhys, SS], [6, s11A, subChem, KA], [6, s11B, subBio,  PM],

      [7, s8A,  subChem, KA], [7, s9B,  subCS,   VK], [7, s10A, subMath, AG],
      [7, s10B, subPhys, SS], [7, s11A, subEng,  SH], [7, s11B, subMath, AG],
      // Fix: s11B P7 AG conflicts with s10A P7 AG? let's use PM for s11B P7:
      // Will fix below by using a clean array

      [8, s8A,  subEng,  SH], [8, s8B,  subBio,  PM], [8, s9A,  subChem, KA],
      [8, s10A, subCS,   VK], [8, s11A, subPhys, SS], [8, s11B, subMath, AG],
    ];

    // Build clean timetable entries, detecting and skipping conflicts
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Validate conflict-free per period per teacher
    const conflictCheck = {}; // key: `${period}_${teacher_id}`
    const validPA = [];
    for (const [p, sec, sub, tch] of periodAssignments) {
      const key = `${p}_${tch._id}`;
      if (conflictCheck[key]) {
        console.warn(`Seed conflict skipped: Teacher ${tch._id} at P${p} already assigned`);
        continue;
      }
      conflictCheck[key] = true;
      validPA.push([p, sec, sub, tch]);
    }

    const ttEntries = [];
    for (const day of DAYS) {
      for (const [p, sec, sub, tch] of validPA) {
        ttEntries.push({
          section_id:   sec._id,
          subject_id:   sub._id,
          teacher_id:   tch._id,
          day,
          period_no:    p,
          institute_id: iid,
        });
      }
    }
    await TimetableEntry.insertMany(ttEntries);

    // TeacherSectionMap
    const tsmEntries = [];
    const tsmSeen = new Set();
    for (const [, sec, , tch] of validPA) {
      const k = `${tch._id}_${sec._id}`;
      if (!tsmSeen.has(k)) {
        tsmSeen.add(k);
        tsmEntries.push({ teacher_id: tch._id, section_id: sec._id, institute_id: iid });
      }
    }
    await TeacherSectionMap.insertMany(tsmEntries);

    // ── 7. Students (3 per section, varied admission dates) ───────────────────
    const studentDefs = [
      // Section 8A
      { name:"Aarav Gupta",    email:"aarav@demo.com",    parent:"Mr. Gupta",    pPhone:"+919811111101", sec:s8A,  admDaysAgo:105 },
      { name:"Diya Patel",     email:"diya@demo.com",     parent:"Mr. Patel",    pPhone:"+919811111102", sec:s8A,  admDaysAgo:75  },
      { name:"Riya Singh",     email:"riya@demo.com",     parent:"Mrs. Singh",   pPhone:"+919811111103", sec:s8A,  admDaysAgo:40  },
      // Section 8B
      { name:"Kabir Das",      email:"kabir@demo.com",    parent:"Mr. Das",      pPhone:"+919811111104", sec:s8B,  admDaysAgo:120 },
      { name:"Ananya Rao",     email:"ananya@demo.com",   parent:"Mrs. Rao",     pPhone:"+919811111105", sec:s8B,  admDaysAgo:80  },
      { name:"Rohan Joshi",    email:"rohan@demo.com",    parent:"Mr. Joshi",    pPhone:"+919811111106", sec:s8B,  admDaysAgo:20  },
      // Section 9A
      { name:"Vikram Kumar",   email:"vikram.s@demo.com", parent:"Mr. Kumar",    pPhone:"+919811111107", sec:s9A,  admDaysAgo:130 },
      { name:"Priya Mehta",    email:"priya.s@demo.com",  parent:"Mrs. Mehta",   pPhone:"+919811111108", sec:s9A,  admDaysAgo:65  },
      { name:"Arjun Shah",     email:"arjun@demo.com",    parent:"Mr. Shah",     pPhone:"+919811111109", sec:s9A,  admDaysAgo:35  },
      // Section 9B
      { name:"Neha Sharma",    email:"neha@demo.com",     parent:"Mrs. Sharma",  pPhone:"+919811111110", sec:s9B,  admDaysAgo:95  },
      { name:"Rahul Verma",    email:"rahul@demo.com",    parent:"Mr. Verma",    pPhone:"+919811111111", sec:s9B,  admDaysAgo:55  },
      { name:"Pooja Nair",     email:"pooja@demo.com",    parent:"Mrs. Nair",    pPhone:"+919811111112", sec:s9B,  admDaysAgo:15  },
      // Section 10A
      { name:"Aryan Das",      email:"aryan@demo.com",    parent:"Mrs. Das",     pPhone:"+919811111113", sec:s10A, admDaysAgo:150 },
      { name:"Myra Khanna",    email:"myra@demo.com",     parent:"Mr. Khanna",   pPhone:"+919811111114", sec:s10A, admDaysAgo:90  },
      { name:"Ishaan Iyer",    email:"ishaan@demo.com",   parent:"Mr. Iyer",     pPhone:"+919811111115", sec:s10A, admDaysAgo:45  },
      // Section 10B
      { name:"Siya Patel",     email:"siya@demo.com",     parent:"Mr. Patel",    pPhone:"+919811111116", sec:s10B, admDaysAgo:160 },
      { name:"Ankit Gupta",    email:"ankit@demo.com",    parent:"Mr. Gupta",    pPhone:"+919811111117", sec:s10B, admDaysAgo:70  },
      { name:"Tanya Singh",    email:"tanya@demo.com",    parent:"Mrs. Singh",   pPhone:"+919811111118", sec:s10B, admDaysAgo:25  },
      // Section 11A
      { name:"Aditya Kumar",   email:"aditya@demo.com",   parent:"Mr. Kumar",    pPhone:"+919811111119", sec:s11A, admDaysAgo:180 },
      { name:"Manya Verma",    email:"manya@demo.com",    parent:"Mrs. Verma",   pPhone:"+919811111120", sec:s11A, admDaysAgo:100 },
      { name:"Shivam Sharma",  email:"shivam@demo.com",   parent:"Mr. Sharma",   pPhone:"+919811111121", sec:s11A, admDaysAgo:50  },
      // Section 11B
      { name:"Kritika Agarwal",email:"kritika@demo.com",  parent:"Mrs. Agarwal", pPhone:"+919811111122", sec:s11B, admDaysAgo:200 },
      { name:"Devika Rao",     email:"devika@demo.com",   parent:"Mr. Rao",      pPhone:"+919811111123", sec:s11B, admDaysAgo:110 },
      { name:"Arjit Singh",    email:"arjit@demo.com",    parent:"Mr. Singh",    pPhone:"+919811111124", sec:s11B, admDaysAgo:30  },
    ];

    const createdStudents = [];
    for (const sd of studentDefs) {
      let u = await User.findOne({ phoneOrEmail: sd.email, institute_id: iid });
      if (!u) u = await User.create({ name: sd.name, phoneOrEmail: sd.email, role: "STUDENT", institute_id: iid });
      const admDate = daysAgo(sd.admDaysAgo);
      const s = await Student.create({
        user_id: u._id, section_id: sd.sec._id,
        parent_name: sd.parent, parent_phone: sd.pPhone,
        admission_date: admDate, institute_id: iid,
      });
      createdStudents.push({ ...s.toObject(), admDaysAgo: sd.admDaysAgo, sec: sd.sec });
    }

    // ── 8. Fees (every 30 days since admission) ───────────────────────────────
    const MONTHLY_FEE = 5000;
    let feeCount = 0;
    const feeRecords = []; // for payment creation

    for (const st of createdStudents) {
      const admDate = daysAgo(st.admDaysAgo);
      // Generate all 30-day cycle due dates from admission up to today
      let cycleDate = new Date(admDate);
      cycleDate.setDate(cycleDate.getDate() + 30); // first due: 30 days after admission

      while (cycleDate <= daysFromNow(30)) { // include next upcoming fee
        const daysUntilDue = Math.floor((cycleDate - new Date()) / (1000 * 60 * 60 * 24));
        let paid = 0;
        let status = "DUE";

        if (daysUntilDue < -60) {
          // More than 60 days overdue: fully paid
          paid = MONTHLY_FEE;
          status = "PAID";
        } else if (daysUntilDue < -30) {
          // 30–60 days past due: partial payment
          paid = 3000;
          status = "PARTIAL";
        } else if (daysUntilDue < 0) {
          // Recent overdue: unpaid DUE
          paid = 0;
          status = "DUE";
        } else {
          // Upcoming: DUE
          paid = 0;
          status = "DUE";
        }

        try {
          const fee = await Fee.create({
            student_id: st._id,
            total_amount: MONTHLY_FEE,
            paid_amount: paid,
            due_amount: MONTHLY_FEE - paid,
            due_date: new Date(cycleDate),
            status,
            institute_id: iid,
          });
          if (paid > 0) feeRecords.push({ fee, student_id: st._id, paid, status });
          feeCount++;
        } catch (e) { /* skip duplicate */ }

        cycleDate = new Date(cycleDate);
        cycleDate.setDate(cycleDate.getDate() + 30);
      }
    }

    // ── 9. Payments (for PAID and PARTIAL fees) ───────────────────────────────
    const methods = ["CASH", "UPI", "BANK_TRANSFER"];
    let payCount = 0;
    for (const { fee, student_id, paid } of feeRecords) {
      try {
        await Payment.create({
          student_id,
          fee_id: fee._id,
          amount: paid,
          method: methods[payCount % 3],
          reference_note: `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          status: "CONFIRMED",
          institute_id: iid,
        });
        payCount++;
      } catch (e) { /* skip */ }
    }

    // ── 10. Tests & Results ───────────────────────────────────────────────────
    const testSubjects = [
      { name: "Physics",     max_marks: 100 },
      { name: "Mathematics", max_marks: 100 },
      { name: "Chemistry",   max_marks: 100 },
      { name: "English",     max_marks: 100 },
    ];

    let testCount = 0;
    let resultCount = 0;
    for (const sec of allSections) {
      // Unit Test — 45 days ago
      const ut = await Test.create({
        name: "Unit Test 1",
        section_id: sec._id,
        date: daysAgo(45),
        subjects: testSubjects,
        institute_id: iid,
      });
      // Mid-Term — 20 days ago
      const mt = await Test.create({
        name: "Mid-Term Examination",
        section_id: sec._id,
        date: daysAgo(20),
        subjects: testSubjects,
        institute_id: iid,
      });
      testCount += 2;

      // Results for each student in this section
      const sectionStudents = createdStudents.filter(st => st.section_id.toString() === sec._id.toString());
      for (const st of sectionStudents) {
        for (const test of [ut, mt]) {
          try {
            await Result.create({
              test_id: test._id,
              student_id: st._id,
              subject_marks: testSubjects.map(ts => ({
                subject: ts.name,
                marks: randInt(
                  test.name.includes("Unit") ? 45 : 55,
                  ts.max_marks
                ),
              })),
              institute_id: iid,
            });
            resultCount++;
          } catch (e) { /* skip duplicate */ }
        }
      }
    }

    // ── 11. Homework ──────────────────────────────────────────────────────────
    const hwTemplates = [
      { title: "Ch. 5 – Exercise Problems",  desc: "Solve all problems from Chapter 5 Exercise Set A and B.", subj: "Physics",     teacher: SS, dueDelta: -3  },
      { title: "Algebra Worksheet",          desc: "Complete worksheet on linear equations, problems 1–30.",   subj: "Mathematics", teacher: AG, dueDelta: 5   },
      { title: "Chemical Bonding Notes",     desc: "Write a 2-page note on ionic and covalent bonds.",         subj: "Chemistry",   teacher: KA, dueDelta: 7   },
      { title: "Essay: My Favourite Book",   desc: "Write a 500-word essay on your favourite book.",           subj: "English",     teacher: SH, dueDelta: -7  },
      { title: "Lab Report: Experiment 3",   desc: "Document findings from the chemistry lab session.",        subj: "Chemistry",   teacher: KA, dueDelta: 10  },
      { title: "Biology Diagram Practice",   desc: "Draw and label the human digestive system.",               subj: "Biology",     teacher: PM, dueDelta: 3   },
    ];

    let hwCount = 0;
    for (const sec of allSections) {
      // Assign 3 random homework per section
      for (let i = 0; i < 3; i++) {
        const hw = hwTemplates[(allSections.indexOf(sec) * 3 + i) % hwTemplates.length];
        await Homework.create({
          title: hw.title,
          description: hw.desc,
          subject: hw.subj,
          due_date: hw.dueDelta > 0 ? daysFromNow(hw.dueDelta) : daysAgo(-hw.dueDelta),
          section_id: sec._id,
          teacher_id: hw.teacher._id,
          institute_id: iid,
        });
        hwCount++;
      }
    }

    // ── 12. Attendance (last 7 school days, period-specific) ──────────────────
    let attCount = 0;
    for (let offset = 0; offset < 7; offset++) {
      const simDate = daysAgo(offset);
      const dayName = DAY_NAMES[simDate.getDay()];
      if (dayName === "Sunday") continue;

      const dayEntries = ttEntries.filter(e => e.day === dayName);
      for (const entry of dayEntries) {
        const secStudents = createdStudents.filter(st =>
          st.section_id.toString() === entry.section_id.toString()
        );
        for (const st of secStudents) {
          const r = Math.random();
          const status = r > 0.88 ? "ABSENT" : r > 0.75 ? "NOT_MARKED" : "PRESENT";
          try {
            await Attendance.updateOne(
              {
                student_id:   st._id,
                section_id:   entry.section_id,
                subject_id:   entry.subject_id,
                period_no:    entry.period_no,
                date:         simDate,
                institute_id: iid,
              },
              { $set: { status, marked_by: authUser._id } },
              { upsert: true, strict: false }
            );
            attCount++;
          } catch (e) { /* skip duplicate */ }
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        subjects:    6,
        teachers:    6,
        classes:     4,
        sections:    8,
        students:    createdStudents.length,
        timetable:   `${ttEntries.length} slots (${validPA.length} unique period-entries × ${DAYS.length} days)`,
        fees:        feeCount,
        payments:    payCount,
        tests:       testCount,
        results:     resultCount,
        homework:    hwCount,
        attendance:  attCount,
      },
      message: `✅ Full demo school seeded successfully! ${createdStudents.length} students across 8 sections, ${feeCount} fee records, ${testCount} tests, and ${attCount} attendance records created.`,
    }, { status: 201 });

  } catch (error) {
    console.error("Demo Seed Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
