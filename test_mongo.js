const mongoose = require('mongoose');

const uri = "mongodb+srv://new_db_user:test123@cluster0.h8qjgpf.mongodb.net/coaching_one?appName=Cluster0";

async function testConnection() {
    try {
        console.log("Attempting to connect to MongoDB...");
        await mongoose.connect(uri);
        console.log("Successfully connected to coaching_one!");
        
        // Let's create a dummy document to force the database to be created
        const Dummy = mongoose.model('Dummy', new mongoose.Schema({ name: String }));
        await Dummy.create({ name: 'Init' });
        console.log("Successfully wrote data. Database should now appear in Atlas.");
        
        process.exit(0);
    } catch (e) {
        console.error("Connection failed:", e);
        process.exit(1);
    }
}

testConnection();
