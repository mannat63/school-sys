import mongoose from 'mongoose';
async function run() {
  await mongoose.connect('mongodb+srv://new_db_user:test123@cluster0.h8qjgpf.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
  const TimetableEntry = mongoose.model('TimetableEntry', new mongoose.Schema({ teacher_id: mongoose.Types.ObjectId }));
  const result = await TimetableEntry.updateMany(
    { teacher_id: '69dfdc9b33374248b6a90ba2' },
    { $set: { teacher_id: '69daa20fe471c319db6d9a79' } }
  );
  console.log('Updated timetable entries:', result.modifiedCount);
  process.exit(0);
}
run();
