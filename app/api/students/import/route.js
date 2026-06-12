import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Student from "@/models/Student";
import User from "@/models/User";
import Section from "@/models/Section";
import Fee from "@/models/Fee";

export async function POST(req) {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);

    const formData = await req.formData();
    const file = formData.get("file");
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const rows = text.split("\n").map((r) => r.trim()).filter((r) => r);
    
    if (rows.length < 2) {
      return NextResponse.json({ error: "File must contain a header row and at least one data row" }, { status: 400 });
    }

    // Skip header row
    const dataRows = rows.slice(1);

    // Fetch all sections to map by name
    const sections = await Section.find({ institute_id: authUser.institute_id });
    const sectionMap = {};
    sections.forEach(b => {
      sectionMap[b.name.toLowerCase()] = b._id;
    });

    let imported = 0;
    let failed = 0;
    const errors = [];

    // Parse parsing standard CSV (handling basic quoted strings could be added, but keeping it simple for now as requested)
    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2; // +1 for 0-index, +1 for header
      const cols = dataRows[i].split(",").map(c => c.trim().replace(/^"|"$/g, ''));
      
      const [name, parent_phone, section_name, admission_date_raw, total_fee] = cols;

      if (!name || !parent_phone || !section_name) {
        errors.push(`Row ${rowNum}: Missing required fields (Name, Phone, or Section Name)`);
        failed++;
        continue;
      }

      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parent_phone);
      const isPhone = /^\+?[0-9]{10,15}$/.test(parent_phone.replace(/[\s-]/g, ''));
      if (!isEmail && !isPhone) {
        errors.push(`Row ${rowNum}: Invalid phone/email format "${parent_phone}"`);
        failed++;
        continue;
      }

      let bId = sectionMap[section_name.toLowerCase()];
      if (!bId) {
        const newSection = await Section.create({
           name: section_name,
           institute_id: authUser.institute_id
        });
        bId = newSection._id;
        sectionMap[section_name.toLowerCase()] = bId;
      }

      // Check duplicate student by phone
      const existingUser = await User.findOne({ phoneOrEmail: parent_phone });
      const existingStudent = await Student.findOne({ parent_phone, institute_id: authUser.institute_id });
      
      if (existingUser || existingStudent) {
        errors.push(`Row ${rowNum}: Student with phone ${parent_phone} already exists`);
        failed++;
        continue;
      }

      // Parse date safely
      let admission_date = new Date();
      if (admission_date_raw) {
        const parsed = new Date(admission_date_raw);
        if (!isNaN(parsed.getTime())) {
          admission_date = parsed;
        }
      }

      try {
        const user = await User.create({
          name,
          phoneOrEmail: parent_phone,
          role: "STUDENT",
          institute_id: authUser.institute_id
        });

        const student = await Student.create({
          user_id: user._id,
          section_id: bId,
          parent_name: "Parent of " + name, // Since format only gives phone, we infer parent name or use student name
          parent_phone,
          admission_date,
          institute_id: authUser.institute_id
        });

        const parsedFee = parseFloat(total_fee);
        if (!isNaN(parsedFee) && parsedFee >= 0) {
          await Fee.create({
            student_id: student._id,
            total_amount: parsedFee,
            paid_amount: 0,
            due_amount: parsedFee,
            due_date: admission_date,
            status: "DUE",
            institute_id: authUser.institute_id
          });
        }

        imported++;
      } catch (dbErr) {
        errors.push(`Row ${rowNum}: Database error - ${dbErr.message}`);
        failed++;
      }
    }

    return NextResponse.json({
      message: `Import complete. Success: ${imported}, Failed: ${failed}`,
      imported,
      failed,
      errors
    }, { status: 200 });

  } catch (error) {
    console.error("CSV Import Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
