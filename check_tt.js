import mongoose from 'mongoose';
async function run() {
  await mongoose.connect('mongodb+srv://new_db_user:test123@cluster0.h8qjgpf.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
  const User = mongoose.model('User', new mongoose.Schema({ name: String, role: String, phoneOrEmail: String }));
  const Teacher = mongoose.model('Teacher', new mongoose.Schema({ user_id: mongoose.Types.ObjectId }));
  const TimetableEntry = mongoose.model('TimetableEntry', new mongoose.Schema({ teacher_id: mongoose.Types.ObjectId }));
  
  const teachers = await Teacher.find({}).lean();
  const tt = await TimetableEntry.aggregate([{ $group: { _id: '$teacher_id', count: { $sum: 1 } } }]);
  const userMap = {};
  const users = await User.find({ role: 'TEACHER' }).lean();
  for (const u of users) userMap[u._id.toString()] = u;
  
  for (const t of teachers) {
    const u = userMap[t.user_id.toString()];
    const count = tt.find(e => e._id.toString() === t._id.toString())?.count || 0;
    console.log(`Teacher ID: ${t._id}, User Name: ${u?.name}, Email: ${u?.phoneOrEmail}, Timetable Entries: ${count}`);
  }
  process.exit(0);
}
run();
