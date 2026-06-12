import { NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { requireRole } from "@/lib/auth";
import Class from "@/models/Class";
import Section from "@/models/Section";
import Student from "@/models/Student";

export const dynamic = "force-dynamic";

/**
 * POST /api/promote-students
 * Promotes every student to the next sequential class.
 * Logic:
 *  1. Fetch all classes sorted by numeric name (8,9,10,11,12)
 *  2. For each class (except the last), find the "next" class
 *  3. Move students from every section in the current class → the first
 *     matching section (by name) in the next class. If no match, use the
 *     first section of the next class.
 *  4. Students in the highest class are graduated (no section move — just
 *     returned in the report so admin can decide).
 */
export async function POST() {
  try {
    await dbConnect();
    const authUser = await requireRole(["ADMIN"]);
    const iid = authUser.institute_id;

    // 1. Load all classes sorted numerically
    const allClasses = await Class.find({ institute_id: iid }).lean();
    allClasses.sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ""), 10);
      const numB = parseInt(b.name.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.name.localeCompare(b.name);
    });

    if (allClasses.length < 2) {
      return NextResponse.json({ error: "Need at least 2 classes to promote students." }, { status: 400 });
    }

    // 2. Build section map: class_id → sections[]
    const allSections = await Section.find({ institute_id: iid }).lean();
    const sectionsByClass = {};
    for (const sec of allSections) {
      const cid = sec.class_id.toString();
      if (!sectionsByClass[cid]) sectionsByClass[cid] = [];
      sectionsByClass[cid].push(sec);
    }

    let promoted = 0;
    let graduated = 0;
    const report = [];

    for (let i = 0; i < allClasses.length; i++) {
      const currentClass = allClasses[i];
      const isLast = i === allClasses.length - 1;
      const currentSections = sectionsByClass[currentClass._id.toString()] || [];

      if (isLast) {
        // Count students in the last class — they graduate
        const count = await Student.countDocuments({
          institute_id: iid,
          section_id: { $in: currentSections.map((s) => s._id) },
        });
        if (count > 0) {
          graduated += count;
          report.push({ class: currentClass.name, action: "graduated", count });
        }
        continue;
      }

      const nextClass = allClasses[i + 1];
      const nextSections = sectionsByClass[nextClass._id.toString()] || [];

      if (nextSections.length === 0) {
        report.push({ class: currentClass.name, action: "skipped — next class has no sections", count: 0 });
        continue;
      }

      // For each section in current class, map to equivalent-named section in next class
      for (const sec of currentSections) {
        // Try to find a section with the same name in the next class
        const matchingNextSec =
          nextSections.find((ns) => ns.name === sec.name) || nextSections[0];

        const result = await Student.updateMany(
          { institute_id: iid, section_id: sec._id },
          { $set: { section_id: matchingNextSec._id } }
        );

        promoted += result.modifiedCount;
        if (result.modifiedCount > 0) {
          report.push({
            class: `${currentClass.name} → ${nextClass.name}`,
            section: `${sec.name} → ${matchingNextSec.name}`,
            action: "promoted",
            count: result.modifiedCount,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      promoted,
      graduated,
      report,
      message: `${promoted} students promoted. ${graduated} students graduated (from highest class).`,
    });
  } catch (error) {
    console.error("Promote students error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
