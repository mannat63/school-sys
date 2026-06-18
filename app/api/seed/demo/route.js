/**
 * POST /api/seed/demo
 * Generates realistic coaching-institute demo data:
 *  - 6 batches (JEE 11 A/B, JEE 12 A/B, NEET 11, Foundation)
 *  - 180 students (30 per batch) with varied performance profiles
 *  - 12 teachers assigned to subjects
 *  - 150 leads with realistic CRM statuses
 *  - 40 tests + ~1200 result records
 *  - ~8000 attendance records (180 students × ~45 days)
 *  - 180 fee records (1 per student) + payment records
 *  - Homework records
 */

import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import mongoose from "mongoose";

import User from "@/models/User";
import Class from "@/models/Class";
import Section from "@/models/Section";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";
import Fee from "@/models/Fee";
import Payment from "@/models/Payment";
import Attendance from "@/models/Attendance";
import Test from "@/models/Test";
import Result from "@/models/Result";
import Homework from "@/models/Homework";
import Lead from "@/models/Lead";
import Subject from "@/models/Subject";
import TimetableEntry from "@/models/TimetableEntry";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min timeout

// ─── Helpers ────────────────────────────────────────────────────────────────

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr)      { return arr[rnd(0, arr.length - 1)]; }
function daysAgo(n)     { const d = new Date(); d.setDate(d.getDate() - n); d.setUTCHours(0,0,0,0); return d; }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }

function backdate(base, daysOffset) {
  const d = new Date(base);
  d.setDate(d.getDate() - daysOffset);
  return d;
}

// ─── Static data ────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Aarav","Aditi","Aditya","Akash","Aman","Ananya","Ankit","Arjun","Aryan","Avni",
  "Ayaan","Deepak","Dev","Diya","Esha","Gaurav","Hardik","Ishaan","Jiya","Kabir",
  "Kartik","Kavya","Krish","Lakshmi","Manav","Meera","Mihir","Mira","Mohit","Naman",
  "Nandini","Neeraj","Neha","Nikhil","Nisha","Om","Palak","Parth","Pooja","Pranav",
  "Priya","Rahul","Ravi","Riya","Rohan","Saanvi","Sahil","Sakshi","Sameer","Sanjana",
  "Sara","Shaan","Shivani","Shreya","Siddharth","Simran","Sneha","Sonal","Sourav","Srishti",
  "Supriya","Tarun","Tanvi","Tushar","Udit","Vaibhav","Vansh","Varsha","Vikas","Vihaan",
  "Vikram","Vivaan","Yash","Yashasvi","Zara","Zoya","Abhinav","Aishwarya","Akanksha","Akhil"
];
const LAST_NAMES = [
  "Sharma","Verma","Patel","Singh","Gupta","Kumar","Joshi","Mehta","Shah","Dubey",
  "Mishra","Agarwal","Bose","Das","Nair","Menon","Iyer","Reddy","Rao","Pillai",
  "Chauhan","Pandey","Tiwari","Yadav","Srivastava","Malhotra","Chopra","Kapoor","Bajaj","Khanna"
];

const TEACHER_POOL = [
  { name:"Dr. Rajiv Sharma",   subjects:["Physics"] },
  { name:"Prof. Sunita Patel", subjects:["Physics","Reasoning"] },
  { name:"Dr. Anil Kumar",     subjects:["Chemistry"] },
  { name:"Ms. Kavitha Menon",  subjects:["Chemistry"] },
  { name:"Prof. Ravi Dubey",   subjects:["Maths"] },
  { name:"Ms. Neha Joshi",     subjects:["Maths"] },
  { name:"Dr. Mohan Das",      subjects:["Biology"] },
  { name:"Ms. Priya Singh",    subjects:["Biology","Chemistry"] },
  { name:"Mr. Suresh Gupta",   subjects:["English"] },
  { name:"Dr. Amit Verma",     subjects:["Reasoning","Maths"] },
  { name:"Ms. Divya Nair",     subjects:["Physics","Maths"] },
  { name:"Prof. Kiran Bose",   subjects:["Chemistry","Biology"] },
];

const COUNSELLOR_NAMES = [
  "Deepak Arora","Ritu Bansal","Saurabh Malviya","Pooja Chopra","Amit Saxena",
];

const LEAD_STATUSES = ["NEW","CONTACTED","INTERESTED","DEMO_SCHEDULED","FOLLOW_UP","CONVERTED","LOST"];
const LEAD_STATUS_DIST = [
  ...Array(35).fill("NEW"),
  ...Array(40).fill("CONTACTED"),
  ...Array(20).fill("INTERESTED"),
  ...Array(15).fill("DEMO_SCHEDULED"),
  ...Array(25).fill("FOLLOW_UP"),
  ...Array(5).fill("CONVERTED"),    // will be bumped to 25 later
  ...Array(15).fill("LOST"),
];

const SOURCES = ["WEBSITE","GOOGLE_SHEET","REFERRAL","WALK_IN","SOCIAL_MEDIA","PHONE","OTHER"];
const COURSES  = ["JEE 11","JEE 12","NEET 11","NEET 12","Foundation","Dropper Batch"];
const LOST_REASONS = ["Joined competitor","Fee too high","Not interested now","No response","Opted for online course"];

const LEAD_NAMES = [
  "Rohan Mehta","Pooja Sinha","Arjun Gupta","Sneha Patel","Vivek Sharma","Ritika Nair",
  "Sarthak Verma","Ananya Das","Karan Singh","Tanvi Joshi","Dev Malhotra","Priyal Shah",
  "Harshit Dubey","Swati Mishra","Aman Kumar","Isha Agarwal","Nikhil Bose","Megha Rao",
  "Akash Pandey","Priyanka Tiwari","Shubham Yadav","Komal Srivastava","Varun Chopra",
  "Ridhi Kapoor","Mohit Bajaj","Sonali Khanna","Piyush Chauhan","Aditi Sharma",
  "Gaurav Verma","Simran Patel","Yuvraj Singh","Neha Gupta","Aditya Kumar","Shreya Joshi",
  "Rahul Mehta","Kavya Shah","Ishan Dubey","Nandini Mishra","Sourav Kumar","Diya Agarwal",
  "Vikas Nair","Pallavi Menon","Sumit Iyer","Shivani Reddy","Neeraj Rao","Sangeeta Pillai",
  "Rishi Chauhan","Anjali Pandey","Dhruv Tiwari","Preeti Yadav","Kunal Srivastava",
  "Kajal Malhotra","Lalit Chopra","Sweta Kapoor","Vishal Bajaj","Deepa Khanna",
  "Siddharth Sharma","Pallak Verma","Chintu Patel","Monika Singh","Sachin Gupta",
  "Neelam Kumar","Amrita Joshi","Bhavesh Mehta","Seema Shah","Kaustubh Dubey",
  "Poonam Mishra","Girish Kumar","Rashmi Agarwal","Anuj Bose","Shweta Das",
  "Pawan Nair","Divya Menon","Ajay Iyer","Sunita Reddy","Vijay Rao","Kavita Pillai",
  "Tushar Chauhan","Alka Pandey","Hemant Tiwari","Meenakshi Yadav","Sunil Srivastava",
  "Puja Malhotra","Shailesh Chopra","Vandana Kapoor","Abhishek Bajaj","Renu Khanna",
  "Deepak Sharma","Geeta Verma","Suresh Patel","Lata Singh","Ramesh Gupta",
  "Sunanda Kumar","Ashok Joshi","Pushpa Mehta","Manish Shah","Savita Dubey",
  "Brijesh Mishra","Rekha Kumar","Vinod Agarwal","Mamta Bose","Jitendra Das",
  "Indu Nair","Pramod Menon","Usha Iyer","Santosh Reddy","Lalita Rao",
  "Nagesh Pillai","Kamla Chauhan","Manohar Pandey","Saroj Tiwari","Brij Yadav",
  "Chandrakala Srivastava","Ramakant Malhotra","Sarita Chopra","Dinesh Kapoor",
  "Pushplata Bajaj","Gajanan Khanna","Indira Sharma","Prakash Verma","Madhuri Patel",
  "Vasant Singh","Kalyani Gupta","Govind Kumar","Meera Joshi","Sudhir Mehta",
  "Nalini Shah","Balkrishna Dubey","Champa Mishra","Jagdish Kumar","Sudha Agarwal",
  "Vitthal Bose","Sushma Das","Dattatray Nair","Laxmi Menon","Purushottam Iyer",
  "Vimala Reddy","Bhagirath Rao","Urmila Pillai","Tryambak Chauhan","Prabha Pandey",
  "Shrikant Tiwari","Bhagwati Yadav","Narayan Srivastava","Kamlesh Malhotra",
  "Sheela Chopra","Rajaram Kapoor","Chandrabai Bajaj","Vitthal Khanna",
  "Sulochana Sharma","Dattatreya Verma","Kanchan Patel","Subhash Singh","Nirmala Gupta",
];

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST() {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const iid = authUser.institute_id;
    const oid = new mongoose.Types.ObjectId(iid);

    const log = [];
    const t0  = Date.now();
    const tag  = (msg) => { log.push(`[${Date.now()-t0}ms] ${msg}`); console.log(msg); };

    // ── WIPE existing data ───────────────────────────────────────────────────
    tag("Wiping existing data...");
    await Promise.all([
      Student.deleteMany({ institute_id: iid }),
      Teacher.deleteMany({ institute_id: iid }),
      Class.deleteMany({ institute_id: iid }),
      Section.deleteMany({ institute_id: iid }),
      Subject.deleteMany({ institute_id: iid }),
      Fee.deleteMany({ institute_id: iid }),
      Attendance.deleteMany({ institute_id: iid }),
      Test.deleteMany({ institute_id: iid }),
      Result.deleteMany({ institute_id: iid }),
      Payment.deleteMany({ institute_id: iid }),
      Homework.deleteMany({ institute_id: iid }),
      Lead.deleteMany({ institute_id: iid }),
      User.deleteMany({ institute_id: iid, role: { $ne: "ADMIN" } }),
      TimetableEntry.deleteMany({ institute_id: iid }),
    ]);
    tag("Wipe complete");

    // ── CLASSES ──────────────────────────────────────────────────────────────
    tag("Creating classes...");
    const [jee11Class, jee12Class, neet11Class, foundClass] = await Class.insertMany([
      { name: "JEE 11",      institute_id: iid },
      { name: "JEE 12",      institute_id: iid },
      { name: "NEET 11",     institute_id: iid },
      { name: "Foundation",  institute_id: iid },
    ]);

    // ── SUBJECTS ─────────────────────────────────────────────────────────────
    tag("Creating subjects...");
    const subjectNames = ["Physics","Chemistry","Maths","Biology","English","Reasoning"];
    const subjectDocs  = await Subject.insertMany(
      subjectNames.map(name => ({ name, institute_id: iid }))
    );
    const subjectMap = Object.fromEntries(subjectDocs.map(s => [s.name, s._id]));

    // ── SECTIONS ─────────────────────────────────────────────────────────────
    tag("Creating sections...");
    const [jee11A, jee11B, jee12A, jee12B, neet11, found] = await Section.insertMany([
      { name: "A", class_id: jee11Class._id,  institute_id: iid },
      { name: "B", class_id: jee11Class._id,  institute_id: iid },
      { name: "A", class_id: jee12Class._id,  institute_id: iid },
      { name: "B", class_id: jee12Class._id,  institute_id: iid },
      { name: "A", class_id: neet11Class._id, institute_id: iid },
      { name: "A", class_id: foundClass._id,  institute_id: iid },
    ]);
    const sections = [jee11A, jee11B, jee12A, jee12B, neet11, found];

    // ── TEACHERS ─────────────────────────────────────────────────────────────
    tag("Creating 12 teachers...");
    const teacherUserDocs = await User.insertMany(
      TEACHER_POOL.map((t, i) => ({
        name:         t.name,
        phoneOrEmail: `teacher${i+1}@alphaschool.in`,
        role:         "TEACHER",
        institute_id: iid,
      }))
    );
    const teacherDocs = await Teacher.insertMany(
      teacherUserDocs.map((u, i) => ({
        user_id:      u._id,
        subjects:     TEACHER_POOL[i].subjects.map(s => subjectMap[s]).filter(Boolean),
        institute_id: iid,
      }))
    );

    // Build counsellor user IDs (first 5 teachers act as counsellors)
    const counsellorIds = teacherUserDocs.slice(0, 5).map(u => u._id);

    tag(`Teachers created: ${teacherDocs.length}`);

    // ── STUDENTS ─────────────────────────────────────────────────────────────
    tag("Creating 180 students...");

    // Performance profiles (assigned per student index within section)
    // 0-4: top performers   (marks 80-95%)
    // 5-9: good             (marks 65-79%)
    // 10-18: average        (marks 45-64%)
    // 19-23: struggling     (marks 30-44%)
    // 24-26: at-risk attend (<65% attendance)
    // 27-28: fee defaulters
    // 29: worst case (low attendance + fee due + failing)

    const PERF_PROFILES = [
      // top 5
      { attRate: 0.93, baseScore: 83 }, { attRate: 0.91, baseScore: 87 }, { attRate: 0.95, baseScore: 90 },
      { attRate: 0.88, baseScore: 85 }, { attRate: 0.92, baseScore: 82 },
      // good 5
      { attRate: 0.85, baseScore: 72 }, { attRate: 0.82, baseScore: 68 }, { attRate: 0.87, baseScore: 75 },
      { attRate: 0.80, baseScore: 70 }, { attRate: 0.83, baseScore: 67 },
      // average 9
      { attRate: 0.78, baseScore: 58 }, { attRate: 0.75, baseScore: 55 }, { attRate: 0.77, baseScore: 52 },
      { attRate: 0.73, baseScore: 50 }, { attRate: 0.80, baseScore: 60 }, { attRate: 0.76, baseScore: 53 },
      { attRate: 0.74, baseScore: 48 }, { attRate: 0.79, baseScore: 56 }, { attRate: 0.72, baseScore: 45 },
      // struggling 5
      { attRate: 0.70, baseScore: 38 }, { attRate: 0.68, baseScore: 35 }, { attRate: 0.71, baseScore: 42 },
      { attRate: 0.65, baseScore: 32 }, { attRate: 0.69, baseScore: 40 },
      // at-risk attendance 3
      { attRate: 0.55, baseScore: 50 }, { attRate: 0.48, baseScore: 45 }, { attRate: 0.42, baseScore: 35 },
      // fee defaulters 2
      { attRate: 0.78, baseScore: 60, feeDefault: true }, { attRate: 0.80, baseScore: 62, feeDefault: true },
      // worst case 1
      { attRate: 0.38, baseScore: 28, feeDefault: true },
    ];

    // Build unique names pool (180 unique names)
    const usedNames = new Set();
    function uniqueName() {
      for (let attempt = 0; attempt < 200; attempt++) {
        const n = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        if (!usedNames.has(n)) { usedNames.add(n); return n; }
      }
      return `Student ${usedNames.size + 1}`;
    }

    // Spread admissions over last 6 months: peak 4-5 months ago, declining recently
    // Month distribution: [5m ago: 40, 4m: 35, 3m: 28, 2m: 22, 1m: 14, current: 11 total but spread]
    const admissionDistribution = [
      ...Array(40).fill(5), ...Array(35).fill(4), ...Array(28).fill(3),
      ...Array(22).fill(2), ...Array(14).fill(1), ...Array(11).fill(0),
    ]; // 150 entries — shuffle and pick first 180 (cycle)

    let admIdx = 0;
    const studentRows = []; // { sectionId, profileIdx, userIdx }

    const userInsertDocs = [];
    const studentInsertDocs = [];

    sections.forEach((sec, secIdx) => {
      for (let i = 0; i < 30; i++) {
        const profileIdx = i % PERF_PROFILES.length;
        const name       = uniqueName();
        const email      = `${name.toLowerCase().replace(/\s+/g,".").replace(/[^a-z.]/g,"")}.${secIdx}${i}@student.in`;
        const parentName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        const monthsAgo  = admissionDistribution[admIdx++ % admissionDistribution.length];
        const admDate    = daysAgo(monthsAgo * 30 + rnd(0, 20));

        userInsertDocs.push({
          name, phoneOrEmail: email, role: "STUDENT", institute_id: iid,
          _id: new mongoose.Types.ObjectId(),
        });
        studentRows.push({ secId: sec._id, profileIdx, parentName, admDate, userDocIdx: userInsertDocs.length - 1 });
      }
    });

    const userDocs = await User.insertMany(userInsertDocs, { ordered: false });

    // Build studentInsert using user _ids
    for (const row of studentRows) {
      const u = userInsertDocs[row.userDocIdx];
      studentInsertDocs.push({
        _id:          new mongoose.Types.ObjectId(),
        user_id:      u._id,
        section_id:   row.secId,
        parent_name:  row.parentName,
        parent_phone: `+91${rnd(70,99)}${String(rnd(10000000,99999999)).padStart(8,"0")}`,
        admission_date: row.admDate,
        institute_id: iid,
        createdAt:    row.admDate,
        updatedAt:    row.admDate,
      });
    }

    await Student.collection.insertMany(studentInsertDocs);
    const studentDocs = studentInsertDocs;
    tag(`Students created: ${studentDocs.length}`);

    // ── FEES ─────────────────────────────────────────────────────────────────
    tag("Creating fee records...");
    const FEE_BY_BATCH = {
      [jee11A._id.toString()]: 75000, [jee11B._id.toString()]: 75000,
      [jee12A._id.toString()]: 80000, [jee12B._id.toString()]: 80000,
      [neet11._id.toString()]: 70000, [found._id.toString()]: 45000,
    };

    const feeDocs = [];
    const paymentDocs = [];
    const now = new Date();

    for (let i = 0; i < studentDocs.length; i++) {
      const s        = studentDocs[i];
      const prof     = PERF_PROFILES[studentRows[i].profileIdx];
      const total    = FEE_BY_BATCH[s.section_id.toString()] || 60000;
      const dueDate  = new Date(s.admission_date);
      dueDate.setDate(dueDate.getDate() + 45);

      let paid = 0;
      if (prof.feeDefault) {
        // defaulter: 0 paid
        paid = 0;
      } else if (i % 10 === 0) {
        paid = 0; // 10% fully unpaid
      } else if (i % 5 === 0) {
        paid = Math.round(total * 0.5); // 20% partial
      } else {
        paid = total; // 70% fully paid
      }

      const feeId = new mongoose.Types.ObjectId();
      feeDocs.push({
        _id:          feeId,
        student_id:   s._id,
        total_amount: total,
        paid_amount:  paid,
        due_amount:   Math.max(0, total - paid),
        due_date:     dueDate,
        status:       paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "DUE",
        institute_id: iid,
        createdAt:    s.admission_date,
        updatedAt:    s.admission_date,
      });

      if (paid > 0) {
        const payDate = new Date(s.admission_date);
        payDate.setDate(payDate.getDate() + rnd(1, 20));
        const method = pick(["CASH","UPI","BANK_TRANSFER"]);
        paymentDocs.push({
          _id:            new mongoose.Types.ObjectId(),
          student_id:     s._id,
          fee_id:         feeId,
          amount:         paid,
          method,
          reference_note: method === "UPI" ? `UPI${rnd(100000000,999999999)}` : undefined,
          status:         "CONFIRMED",
          institute_id:   iid,
          createdAt:      payDate,
          updatedAt:      payDate,
        });
      }
    }

    await Fee.collection.insertMany(feeDocs);
    await Payment.collection.insertMany(paymentDocs);
    tag(`Fees: ${feeDocs.length}, Payments: ${paymentDocs.length}`);

    // ── ATTENDANCE ────────────────────────────────────────────────────────────
    tag("Creating attendance records (~8000)...");
    const TODAY = new Date(); TODAY.setUTCHours(0,0,0,0);
    const WINDOW_DAYS = 46; // ~46 school days gives ~8000 with 180 students

    const attDocs = [];
    const markedBy = authUser._id;

    for (let i = 0; i < studentDocs.length; i++) {
      const s    = studentDocs[i];
      const prof = PERF_PROFILES[studentRows[i].profileIdx];
      const admDate = new Date(s.admission_date); admDate.setUTCHours(0,0,0,0);

      // Declining attendance pattern: some students were good before, bad now
      const isDeclinign = [26, 27, 28, 29].includes(studentRows[i].profileIdx);

      for (let d = 0; d < WINDOW_DAYS; d++) {
        const date = new Date(TODAY);
        date.setDate(TODAY.getDate() - (WINDOW_DAYS - 1 - d));

        if (date < admDate) continue; // before admission
        if (date > TODAY)   continue;

        // Weekend: skip Saturday (6) and Sunday (0)
        const dow = date.getDay();
        if (dow === 0 || dow === 6) continue;

        // Attendance rate: declining students were better in first half
        let rate = prof.attRate;
        if (isDeclinign) {
          rate = d < WINDOW_DAYS / 2 ? Math.min(0.85, rate + 0.25) : rate - 0.15;
        }

        const status = Math.random() < rate ? "PRESENT" : "ABSENT";
        attDocs.push({
          student_id:   s._id,
          section_id:   s.section_id,
          date:         new Date(date),
          status,
          marked_by:    markedBy,
          institute_id: iid,
          createdAt:    new Date(date),
          updatedAt:    new Date(date),
        });
      }
    }

    // Insert in chunks to avoid 16MB document limit
    const ATT_CHUNK = 2000;
    for (let c = 0; c < attDocs.length; c += ATT_CHUNK) {
      await Attendance.collection.insertMany(attDocs.slice(c, c + ATT_CHUNK), { ordered: false });
    }
    tag(`Attendance records: ${attDocs.length}`);

    // ── TESTS ─────────────────────────────────────────────────────────────────
    tag("Creating 40 tests...");

    // Subject configs per section
    const SECTION_SUBJECTS = {
      [jee11A._id.toString()]: [{ name:"Physics",max_marks:100},{ name:"Chemistry",max_marks:100},{ name:"Maths",max_marks:100}],
      [jee11B._id.toString()]: [{ name:"Physics",max_marks:100},{ name:"Chemistry",max_marks:100},{ name:"Maths",max_marks:100}],
      [jee12A._id.toString()]: [{ name:"Physics",max_marks:100},{ name:"Chemistry",max_marks:100},{ name:"Maths",max_marks:100}],
      [jee12B._id.toString()]: [{ name:"Physics",max_marks:100},{ name:"Chemistry",max_marks:100},{ name:"Maths",max_marks:100}],
      [neet11._id.toString()]: [{ name:"Physics",max_marks:180},{ name:"Chemistry",max_marks:180},{ name:"Biology",max_marks:360}],
      [found._id.toString()]:  [{ name:"Physics",max_marks:100},{ name:"Chemistry",max_marks:100},{ name:"Maths",max_marks:100},{ name:"English",max_marks:50}],
    };
    const TEST_NAMES = [
      "Unit Test 1","Unit Test 2","Unit Test 3","Unit Test 4","Unit Test 5","Unit Test 6","Unit Test 7",
    ];
    const TESTS_PER_SECTION = [7,7,7,7,6,6]; // Total = 40

    const testDocs = [];
    sections.forEach((sec, si) => {
      const count = TESTS_PER_SECTION[si];
      const subjs = SECTION_SUBJECTS[sec._id.toString()];
      for (let t = 0; t < count; t++) {
        // Spread tests over last 3 months, one every ~12 days
        const daysBack = (count - t) * 13 + rnd(0,3);
        testDocs.push({
          _id:          new mongoose.Types.ObjectId(),
          name:         TEST_NAMES[t] || `Test ${t+1}`,
          section_id:   sec._id,
          date:         daysAgo(daysBack),
          subjects:     subjs,
          institute_id: iid,
          createdAt:    daysAgo(daysBack),
          updatedAt:    daysAgo(daysBack),
        });
      }
    });

    await Test.collection.insertMany(testDocs);
    tag(`Tests: ${testDocs.length}`);

    // ── RESULTS ───────────────────────────────────────────────────────────────
    tag("Creating test results...");

    // Group students by section
    const studentsBySection = {};
    for (let i = 0; i < studentDocs.length; i++) {
      const secId = studentDocs[i].section_id.toString();
      if (!studentsBySection[secId]) studentsBySection[secId] = [];
      studentsBySection[secId].push({ doc: studentDocs[i], profIdx: studentRows[i].profileIdx });
    }

    const resultDocs = [];
    for (const test of testDocs) {
      const secStudents = studentsBySection[test.section_id.toString()] || [];
      for (const { doc: stu, profIdx } of secStudents) {
        const prof = PERF_PROFILES[profIdx];
        // Score trends: later tests show improvement for top students, decline for at-risk
        const testAge = Math.floor((TODAY - test.date) / (1000*60*60*24)); // days since test
        let scoreBoost = 0;
        if (profIdx < 5)  scoreBoost = -(testAge / 90) * 5;  // top: slightly declining (overconfidence)
        if (profIdx > 23) scoreBoost = -(testAge / 90) * 10; // at-risk: clearly declining over time

        const subjectMarks = test.subjects.map(sub => {
          const base    = prof.baseScore + scoreBoost;
          const max     = sub.max_marks;
          const rawPct  = Math.max(8, Math.min(98, base + rnd(-12, 12)));
          const marks   = Math.round((rawPct / 100) * max);
          return { subject: sub.name, marks };
        });

        resultDocs.push({
          _id:           new mongoose.Types.ObjectId(),
          test_id:       test._id,
          student_id:    stu._id,
          subject_marks: subjectMarks,
          institute_id:  iid,
          createdAt:     test.date,
          updatedAt:     test.date,
        });
      }
    }

    const RES_CHUNK = 1000;
    for (let c = 0; c < resultDocs.length; c += RES_CHUNK) {
      await Result.collection.insertMany(resultDocs.slice(c, c + RES_CHUNK), { ordered: false });
    }
    tag(`Results: ${resultDocs.length}`);

    // ── HOMEWORK ──────────────────────────────────────────────────────────────
    tag("Creating homework...");
    const hwDocs = [];
    const HW_TITLES = {
      Physics:   ["Kinematics Problems","Newton's Laws Practice","Thermodynamics Sheet","Wave Optics Exercises"],
      Chemistry: ["Organic Chemistry Problems","Electrochemistry Sheet","Chemical Equilibrium"],
      Maths:     ["Integration Practice","Matrices Exercise","Probability Set","Vector Algebra"],
      Biology:   ["Cell Biology Notes","Genetics Problems","Ecology Case Study"],
      English:   ["Essay Writing","Comprehension Practice","Grammar Exercises"],
    };

    sections.forEach(sec => {
      const assignments = SECTION_TEACHER_MAP[sec._id.toString()] || [];
      const subjs = SECTION_SUBJECTS[sec._id.toString()].map(s => s.name);
      subjs.forEach(subj => {
        const titles = HW_TITLES[subj] || ["Practice Set"];
        const assignment = assignments.find(a => a.subj === subj);
        const teacherId = assignment && teacherDocs[assignment.teacherIdx] ? teacherDocs[assignment.teacherIdx]._id : teacherDocs[0]._id;

        titles.slice(0,2).forEach((title, i) => {
          hwDocs.push({
            _id:          new mongoose.Types.ObjectId(),
            title,
            description:  `Complete all problems in ${title}`,
            subject:      subj,
            due_date:     daysFromNow(rnd(2,10)),
            section_id:   sec._id,
            teacher_id:   teacherId,
            institute_id: iid,
          });
        });
      });
    });

    await Homework.collection.insertMany(hwDocs, { ordered: false });
    tag(`Homework: ${hwDocs.length}`);

    // ── LEADS ─────────────────────────────────────────────────────────────────
    tag("Creating 150 leads...");

    // Status distribution: 35 NEW, 40 CONTACTED, 20 INTERESTED, 15 DEMO_SCHEDULED, 15 FOLLOW_UP, 10 CONVERTED, 15 LOST
    const LEAD_STATUS_LIST = [
      ...Array(35).fill("NEW"),
      ...Array(40).fill("CONTACTED"),
      ...Array(20).fill("INTERESTED"),
      ...Array(15).fill("DEMO_SCHEDULED"),
      ...Array(15).fill("FOLLOW_UP"),
      ...Array(10).fill("CONVERTED"),
      ...Array(15).fill("LOST"),
    ];

    // Counsellor performance profiles
    const COUNSELLOR_PERF = [
      { convRate: 0.32, responseTime: 1 },  // Top counsellor
      { convRate: 0.25, responseTime: 2 },  // Good
      { convRate: 0.18, responseTime: 3 },  // Average
      { convRate: 0.12, responseTime: 6 },  // Below average
      { convRate: 0.06, responseTime: 24 }, // Poor
    ];

    const leadDocs = [];
    for (let i = 0; i < 150; i++) {
      const status       = LEAD_STATUS_LIST[i];
      const counsellIdx  = i % 5;
      const counsellor   = counsellorIds[counsellIdx];
      const createdDaysAgo = rnd(1, 90);
      const course       = pick(COURSES);

      let follow_up_date = undefined;
      let lost_reason    = undefined;
      if (status === "FOLLOW_UP" || status === "INTERESTED" || status === "DEMO_SCHEDULED") {
        follow_up_date = daysFromNow(rnd(1, 14));
      }
      if (status === "LOST") {
        lost_reason = pick(LOST_REASONS);
      }

      const name = LEAD_NAMES[i % LEAD_NAMES.length] + (i >= LEAD_NAMES.length ? ` ${Math.floor(i/LEAD_NAMES.length)+1}` : "");
      leadDocs.push({
        _id:            new mongoose.Types.ObjectId(),
        name,
        phone:          `+91${rnd(70,99)}${String(rnd(10000000,99999999)).padStart(8,"0")}`,
        email:          `${name.toLowerCase().replace(/\s+/g,".")}${i}@gmail.com`,
        source:         pick(SOURCES),
        status,
        course_interest: course,
        notes:          status === "CONTACTED" ? "Called but no response, follow up next week" :
                        status === "INTERESTED" ? "Very interested, needs time to decide" :
                        status === "DEMO_SCHEDULED" ? "Demo booked for upcoming Saturday" :
                        undefined,
        assigned_to:    counsellor,
        follow_up_date,
        lost_reason,
        institute_id:   iid,
        createdAt:      daysAgo(createdDaysAgo),
        updatedAt:      daysAgo(Math.max(0, createdDaysAgo - rnd(0,5))),
      });
    }

    await Lead.collection.insertMany(leadDocs);
    tag(`Leads: ${leadDocs.length}`);

    // ── TIMETABLE ─────────────────────────────────────────────────────────────
    tag("Creating timetable entries...");
    const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const PERIODS_PER_DAY = 8;

    // Subject-teacher assignments per section
    const SECTION_TEACHER_MAP = {
      [jee11A._id.toString()]: [
        { subj: "Physics",   teacherIdx: 0 },
        { subj: "Chemistry", teacherIdx: 2 },
        { subj: "Maths",     teacherIdx: 4 },
      ],
      [jee11B._id.toString()]: [
        { subj: "Physics",   teacherIdx: 1 },
        { subj: "Chemistry", teacherIdx: 3 },
        { subj: "Maths",     teacherIdx: 5 },
      ],
      [jee12A._id.toString()]: [
        { subj: "Physics",   teacherIdx: 10 },
        { subj: "Chemistry", teacherIdx: 11 },
        { subj: "Maths",     teacherIdx: 4 },
      ],
      [jee12B._id.toString()]: [
        { subj: "Physics",   teacherIdx: 0 },
        { subj: "Chemistry", teacherIdx: 2 },
        { subj: "Maths",     teacherIdx: 9 },
      ],
      [neet11._id.toString()]: [
        { subj: "Physics",   teacherIdx: 1 },
        { subj: "Chemistry", teacherIdx: 7 },
        { subj: "Biology",   teacherIdx: 6 },
      ],
      [found._id.toString()]: [
        { subj: "Physics",   teacherIdx: 10 },
        { subj: "Chemistry", teacherIdx: 3 },
        { subj: "Maths",     teacherIdx: 5 },
        { subj: "English",   teacherIdx: 8 },
      ],
    };

    // Period rotation: each subject gets 2 periods per day in rotation
    const ttDocs = [];
    for (const sec of sections) {
      const assignments = SECTION_TEACHER_MAP[sec._id.toString()] || [];
      if (!assignments.length) continue;

      for (const day of DAYS) {
        for (let period = 1; period <= PERIODS_PER_DAY; period++) {
          const assign = assignments[(period - 1) % assignments.length];
          const subjectId = subjectMap[assign.subj];
          const teacherId = teacherDocs[assign.teacherIdx]?._id;
          if (!subjectId || !teacherId) continue;
          ttDocs.push({
            _id:          new mongoose.Types.ObjectId(),
            section_id:   sec._id,
            subject_id:   subjectId,
            teacher_id:   teacherId,
            day,
            period_no:    period,
            institute_id: iid,
          });
        }
      }
    }

    await TimetableEntry.collection.insertMany(ttDocs, { ordered: false });
    tag(`Timetable entries: ${ttDocs.length}`);

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalTime = Date.now() - t0;
    tag(`DONE in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      message: "Demo data seeded successfully",
      stats: {
        classes:     4,
        sections:    6,
        subjects:    subjectNames.length,
        teachers:    teacherDocs.length,
        students:    studentDocs.length,
        fees:        feeDocs.length,
        payments:    paymentDocs.length,
        attendance:  attDocs.length,
        tests:       testDocs.length,
        results:     resultDocs.length,
        homework:    hwDocs.length,
        leads:       leadDocs.length,
        timetable:   ttDocs.length,
        timeMs:      totalTime,
      },
      log,
    }, { status: 201 });

  } catch (e) {
    console.error("Demo seed error:", e);
    return NextResponse.json({ success: false, error: e.message, stack: e.stack?.slice(0,500) }, { status: 500 });
  }
}
