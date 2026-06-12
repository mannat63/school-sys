const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function fix() {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ name: String, phoneOrEmail: String, role: String, institute_id: mongoose.Schema.Types.ObjectId }));
    const Student = mongoose.models.Student || mongoose.model('Student', new mongoose.Schema({ user_id: mongoose.Schema.Types.ObjectId, section_id: mongoose.Schema.Types.ObjectId, parent_name: String, parent_phone: String, admission_date: Date, institute_id: mongoose.Schema.Types.ObjectId }, { strict: false }));
    const Section = mongoose.models.Section || mongoose.model('Section', new mongoose.Schema({ name: String, institute_id: mongoose.Schema.Types.ObjectId }, { strict: false }));
    const Institute = mongoose.models.Institute || mongoose.model('Institute', new mongoose.Schema({ name: String }));

    const inst = await Institute.findOne({ name: 'Alpha Coaching' });
    if (!inst) {
        console.log("No inst"); process.exit(0);
    }
    
    // give coachman admin role again just in case
    await User.updateOne({ phoneOrEmail: 'coachman9606@gmail.com' }, { role: 'ADMIN', institute_id: inst._id });

    // camper should be student
    await User.updateOne({ phoneOrEmail: 'campervictor52@gmail.com' }, { role: 'STUDENT', institute_id: inst._id });
    
    const camper = await User.findOne({ phoneOrEmail: 'campervictor52@gmail.com' });
    
    const s = await Student.findOne({ user_id: camper._id });
    if (!s) {
        // give them a section
        const sectionJEE = await Section.findOne({ institute_id: inst._id, name: /JEE/i });
        if (sectionJEE) {
             const admissionDate = new Date();
             admissionDate.setDate(admissionDate.getDate() - 30);
             await Student.create({
                 user_id: camper._id,
                 section_id: sectionJEE._id,
                 parent_name: "Rakesh Bansal",
                 parent_phone: "+911000000001",
                 admission_date: admissionDate,
                 institute_id: inst._id
             });
             console.log("Created student doc for camper");
        } else {
             console.log("No section found");
        }
    } else {
        console.log("Camper student doc already exists");
    }
    
    process.exit(0);
}

fix().catch(err => { console.error(err); process.exit(1); });
