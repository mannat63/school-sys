import mongoose from 'mongoose';
async function run() {
  await mongoose.connect('mongodb+srv://new_db_user:test123@cluster0.h8qjgpf.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
  const TimetableEntry = mongoose.model('TimetableEntry', new mongoose.Schema({ teacher_id: mongoose.Types.ObjectId, section_id: mongoose.Types.ObjectId, day: String, period_no: Number }, { strict: false }));
  const Section = mongoose.model('Section', new mongoose.Schema({ name: String, class_id: mongoose.Types.ObjectId }, { strict: false }));
  const Class = mongoose.model('Class', new mongoose.Schema({ name: String }, { strict: false }));
  const User = mongoose.model('User', new mongoose.Schema({ name: String, phoneOrEmail: String }, { strict: false }));
  const Teacher = mongoose.model('Teacher', new mongoose.Schema({ user_id: mongoose.Types.ObjectId }, { strict: false }));
  
  const victor = await User.findOne({ phoneOrEmail: 'campervictor52@gmail.com' }).sort({updatedAt: -1});
  const teacher = await Teacher.findOne({ user_id: victor._id });
  
  const entries = await TimetableEntry.find({ teacher_id: teacher._id, day: 'Wednesday' }).sort({period_no: 1});
  const sectionIds = [...new Set(entries.map(e => e.section_id.toString()))];
  const sections = await Section.find({ _id: { $in: sectionIds } });
  const classIds = [...new Set(sections.map(s => s.class_id.toString()))];
  const classes = await Class.find({ _id: { $in: classIds } });
  
  for (const e of entries) {
    const sec = sections.find(s => s._id.toString() === e.section_id.toString());
    const cls = classes.find(c => c._id.toString() === sec.class_id.toString());
    console.log(`Period ${e.period_no} -> ${cls.name} - ${sec.name}`);
  }
  process.exit(0);
}
run();
