const mongoose = require("mongoose");
require("dotenv").config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    
    const user = await db.collection("users").findOne({ name: { $regex: /Rajiv Sharma/i } });
    const teacher = await db.collection("teachers").findOne({ user_id: user._id });

    const classDoc = await db.collection("classes").findOne({ name: "JEE 11" });
    const secB = await db.collection("sections").findOne({ class_id: classDoc._id, name: "B" });
    const secA = await db.collection("sections").findOne({ class_id: classDoc._id, name: "A" });

    const ttSecB = await db.collection("timetableentries").find({ section_id: secB._id }).toArray();
    console.log(`Timetable entries for JEE 11 - Sec B: ${ttSecB.length}`);

    const rajivSecB = ttSecB.filter(e => e.teacher_id.toString() === teacher._id.toString());
    console.log(`Rajiv Sharma is allotted to JEE 11 - Sec B for ${rajivSecB.length} periods.`);

    const ttSecA = await db.collection("timetableentries").find({ section_id: secA._id }).toArray();
    const rajivSecA = ttSecA.filter(e => e.teacher_id.toString() === teacher._id.toString());
    console.log(`Rajiv Sharma is allotted to JEE 11 - Sec A for ${rajivSecA.length} periods.`);

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
