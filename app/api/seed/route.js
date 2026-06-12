import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import User from "@/models/User";
import Institute from "@/models/Institute";
import Class from "@/models/Class";
import Course from "@/models/Course";
import Section from "@/models/Section";
import Student from "@/models/Student";
import Teacher from "@/models/Teacher";
import Fee from "@/models/Fee";
import Attendance from "@/models/Attendance";
import Test from "@/models/Test";
import Result from "@/models/Result";
import Payment from "@/models/Payment";
import { INSTITUTE_NAME } from "@/config/appConfig";

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const iid = authUser.institute_id;
    
    // Check if the user wants to force reset (we can just assume yes from the prompt context, but let's always clear for a clean slate)
    await Student.deleteMany({ institute_id: iid });
    await Teacher.deleteMany({ institute_id: iid });
    await Class.deleteMany({ institute_id: iid });
    await Course.deleteMany({ institute_id: iid });
    await Section.deleteMany({ institute_id: iid });
    await Fee.deleteMany({ institute_id: iid });
    await Attendance.deleteMany({ institute_id: iid });
    await Test.deleteMany({ institute_id: iid });
    await Result.deleteMany({ institute_id: iid });
    await Payment.deleteMany({ institute_id: iid });
    
    // Also delete any users that aren't the ADMIN so we get a completely fresh user base
    await User.deleteMany({ institute_id: iid, role: { $ne: "ADMIN" } });

    // 1. Teachers
    const t1User = await User.create({ name: "Priya Sharma", phoneOrEmail: "mannatgoyal27102005@gmail.com", role: "TEACHER", institute_id: iid });
    const t2User = await User.create({ name: "Amit Kumar", phoneOrEmail: "teacher2@gmail.com", role: "TEACHER", institute_id: iid });
    
    const t1 = await Teacher.create({ user_id: t1User._id, institute_id: iid });
    const t2 = await Teacher.create({ user_id: t2User._id, institute_id: iid });

    // 2. Classes & Courses
    const class11 = await Class.create({ name: "Class 11", institute_id: iid });
    const class12 = await Class.create({ name: "Class 12", institute_id: iid });
    const courseScience = await Course.create({ name: "Science", institute_id: iid });
    const courseCommerce = await Course.create({ name: "Commerce", institute_id: iid });

    // 3. Sections
    const section11A = await Section.create({ name: "Section A", class_id: class11._id, teacher_id: t1._id, timing: "8:00 AM - 10:00 AM", institute_id: iid });
    const section12A = await Section.create({ name: "Section A", class_id: class12._id, teacher_id: t2._id, timing: "10:00 AM - 12:00 PM", institute_id: iid });

    // 4. Students (Exactly 10)
    const studentData = [
      { name: "Victor Camper", phone: "campervictor52@gmail.com", parent: "Mr. Camper", parentPhone: "+911000000001", section: section11A._id },
      { name: "Kavya Singh", phone: "kavya@test.com", parent: "Vikram Singh", parentPhone: "+911000000002", section: section11A._id },
      { name: "Vihaan Iyer", phone: "vihaan@test.com", parent: "Rajesh Iyer", parentPhone: "+911000000003", section: section11A._id },
      { name: "Ananya Sharma", phone: "ananya@test.com", parent: "Deepak Sharma", parentPhone: "+911000000004", section: section11A._id },
      { name: "Kabir Dubey", phone: "kabir@test.com", parent: "Amit Dubey", parentPhone: "+911000000005", section: section11A._id },
      { name: "Mira Patel", phone: "mira@test.com", parent: "Suresh Patel", parentPhone: "+911000000006", section: section12A._id },
      { name: "Vivaan Joshi", phone: "vivaan@test.com", parent: "Karan Joshi", parentPhone: "+911000000007", section: section12A._id },
      { name: "Sia Gupta", phone: "sia@test.com", parent: "Ravi Gupta", parentPhone: "+911000000008", section: section12A._id },
      { name: "Reyansh Reddy", phone: "reyansh@test.com", parent: "Raman Reddy", parentPhone: "+911000000009", section: section12A._id },
      { name: "Zara Khan", phone: "zara@test.com", parent: "Imran Khan", parentPhone: "+911000000010", section: section12A._id }
    ];

    const students = [];
    for (const s of studentData) {
      const admissionDate = new Date();
      admissionDate.setDate(admissionDate.getDate() - Math.floor(Math.random() * 60) - 10); // Between 10 and 70 days ago
      
      const u = await User.create({ name: s.name, phoneOrEmail: s.phone, role: "STUDENT", institute_id: iid });
      const doc = await Student.create({ user_id: u._id, section_id: s.section, parent_name: s.parent, parent_phone: s.parentPhone, admission_date: admissionDate, institute_id: iid });
      students.push(doc);
    }

    // 5. Fees (A mix of PAID, PARTIAL, DUE)
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const admissionDate = new Date(student.admission_date);
      
      const dueDate = new Date(admissionDate);
      dueDate.setDate(dueDate.getDate() + 30); // Fees must be paid within 30 days of admission

      const total = 50000;
      let paid = 0;
      if (i % 3 === 0) paid = 50000; // Fully paid
      else if (i % 3 === 1) paid = 25000; // Partial
      else paid = 0; // Unpaid

      const f = new Fee({
        student_id: student._id,
        total_amount: total,
        paid_amount: paid,
        due_amount: total - paid,
        due_date: dueDate,
        institute_id: iid,
      });
      await f.save();

      if (paid > 0) {
        const paymentDate = new Date(admissionDate);
        paymentDate.setDate(paymentDate.getDate() + Math.floor(Math.random() * 15) + 1); // Paid within a couple of weeks of admission
        
        await Payment.create({
          fee_id: f._id,
          student_id: student._id,
          amount: paid,
          method: "CASH",
          status: "CONFIRMED",
          institute_id: iid,
          createdAt: paymentDate, // Backdate the payment so it shows up correctly in historical reports
        });
      }
    }

    // 6. Attendance (from admission date to today)
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    for (let i = 0; i < students.length; i++) {
        const student = students[i];
        const isAbsentArjun = student.parent_name === "Mr. Camper";
        
        const start = new Date(student.admission_date);
        start.setUTCHours(0, 0, 0, 0);

        const daysDiff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        
        // Cap to 70 days just in case, but randomization is 10-70 anyway
        const cappedDays = Math.min(daysDiff, 70);

        for (let d = 0; d <= cappedDays; d++) {
            const date = new Date(start);
            date.setDate(date.getDate() + d);
            date.setUTCHours(0, 0, 0, 0);

            // Arjun is notoriously absent
            let isAbsent = isAbsentArjun ? true : (Math.random() > 0.8);

            await Attendance.create({
                student_id: student._id,
                section_id: student.section_id,
                date,
                status: isAbsent ? "ABSENT" : "PRESENT",
                institute_id: iid,
                marked_by: authUser._id,
            });
        }
    }

    // 7. Tests & Results
    const test11 = await Test.create({ 
      name: "Mock Test 1", 
      section_id: section11A._id, 
      date: new Date(), 
      subjects: [
        { name: "Physics", max_marks: 100 },
        { name: "Chemistry", max_marks: 100 },
        { name: "Maths", max_marks: 100 }
      ],
      institute_id: iid 
    });

    const test12 = await Test.create({ 
      name: "Mock Test 1", 
      section_id: section12A._id, 
      date: new Date(), 
      subjects: [
        { name: "Physics", max_marks: 100 },
        { name: "Chemistry", max_marks: 100 },
        { name: "Maths", max_marks: 100 }
      ],
      institute_id: iid 
    });

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const isClass11 = student.section_id.toString() === section11A._id.toString();
      
      const subject_marks = [
        { subject: "Physics", marks: Math.floor(Math.random() * 80 + 20) },
        { subject: "Chemistry", marks: Math.floor(Math.random() * 80 + 20) },
        { subject: "Maths", marks: Math.floor(Math.random() * 80 + 20) }
      ];
      
      await Result.create({ 
        test_id: isClass11 ? test11._id : test12._id, 
        student_id: student._id, 
        subject_marks,
        institute_id: iid 
      });
    }

    return NextResponse.json({ message: "System wiped and successfully reseeded with exactly 10 students and clean data!", students: students.length }, { status: 201 });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
