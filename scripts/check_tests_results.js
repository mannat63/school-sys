const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const Inst = mongoose.models.Institute || mongoose.model('Institute', new mongoose.Schema({ name: String }));
    const inst = await Inst.findOne({ name: 'Alpha Coaching' });
    
    const Test = mongoose.models.Test || mongoose.model('Test', new mongoose.Schema({ institute_id: mongoose.Schema.Types.ObjectId, name: String, date: Date, section_id: mongoose.Schema.Types.ObjectId }));
    const tests = await Test.find({ institute_id: inst._id });
    console.log('Tests found:', tests.length);
    tests.forEach(t => {
        console.log('  Name:', t.name, 'Date:', t.date, 'Section:', t.section_id);
    });
    
    const Result = mongoose.models.Result || mongoose.model('Result', new mongoose.Schema({ institute_id: mongoose.Schema.Types.ObjectId, test_id: mongoose.Schema.Types.ObjectId }));
    const results = await Result.find({ institute_id: inst._id });
    console.log('Results found:', results.length);
    
    process.exit(0);
}
check();
