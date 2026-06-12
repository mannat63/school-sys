const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function fixRoles() {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ name: String, phoneOrEmail: String, role: String, institute_id: mongoose.Schema.Types.ObjectId }));
    const Student = mongoose.models.Student || mongoose.model('Student', new mongoose.Schema({ user_id: mongoose.Schema.Types.ObjectId, institute_id: mongoose.Schema.Types.ObjectId }, { strict: false }));
    const Teacher = mongoose.models.Teacher || mongoose.model('Teacher', new mongoose.Schema({ user_id: mongoose.Schema.Types.ObjectId, institute_id: mongoose.Schema.Types.ObjectId }, { strict: false }));
    
    console.log("Checking coachman...");
    let coachman = await User.findOne({ phoneOrEmail: 'coachman9606@gmail.com' });
    if (coachman) {
        console.log("Found coachman:", coachman.role);
        coachman.role = "ADMIN";
        await coachman.save();
        
        // Remove from Student collection just in case
        const delRes = await Student.deleteMany({ user_id: coachman._id });
        console.log("Deleted coachman from Student collection:", delRes.deletedCount);
    } else {
        console.log("coachman9606 not found.");
    }
    
    console.log("Checking campervictor...");
    let camper = await User.findOne({ phoneOrEmail: 'campervictor52@gmail.com' });
    if (camper) {
        console.log("Found camper:", camper.role);
        camper.role = "STUDENT";
        await camper.save();
        
        // If they had an ADMIN institute or anything... wait, as admin, their user_id wasn't in Student.
        // We probably need to ensure they have a Student document. Wait, the seed script creates a student document. 
        // If the user hasn't reseeded, camper won't have a student_id linked section.
        // Let's just find the student document that used to belong to coachman and reassign it!
        if (coachman) {
            const oldCoachmanStudent = await Student.findOne({ user_id: coachman._id });
            if (oldCoachmanStudent) {
                oldCoachmanStudent.user_id = camper._id;
                await oldCoachmanStudent.save();
                console.log("Reassigned student doc from coachman to camper.");
            }
        }
    } else {
        console.log("campervictor52 not found.");
        // If the student document existed but the email is different
        // Re-seeding may just be easier for the user if they want.
    }
    
    // Actually, coachman might have had a Student document already.
    // Let's find ANY student document belonging to coachman and assign it to camper, if camper exists. 
    // Wait, the Student model requires section_id, parent_name, etc.
    // I should just update the phone field of ANY User whose phoneOrEmail is coachman but shouldn't be? No, emails are unique usually.

    console.log("Done.");
    process.exit(0);
}

fixRoles().catch(err => { console.error(err); process.exit(1); });
