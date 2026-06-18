const mongoose = require("mongoose");
require("dotenv").config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    
    const homeworks = await db.collection("homeworks").find({}).toArray();
    console.log(`Found ${homeworks.length} homeworks`);

    let updated = 0;
    for (let hw of homeworks) {
      // Find the subject id first by name
      const subjectDoc = await db.collection("subjects").findOne({ name: hw.subject, institute_id: hw.institute_id });
      if (!subjectDoc) continue;

      // Find who teaches this subject in this section
      const ttEntry = await db.collection("timetableentries").findOne({
        section_id: hw.section_id,
        subject_id: subjectDoc._id
      });

      if (ttEntry && ttEntry.teacher_id) {
        if (hw.teacher_id.toString() !== ttEntry.teacher_id.toString()) {
          await db.collection("homeworks").updateOne(
            { _id: hw._id },
            { $set: { teacher_id: ttEntry.teacher_id } }
          );
          updated++;
        }
      }
    }

    console.log(`Updated ${updated} homeworks with correct teacher_id.`);

    // Also fix the seed script so it doesn't happen again.
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
