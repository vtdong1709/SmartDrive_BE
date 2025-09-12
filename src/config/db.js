import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`Connected to DB on host: ${conn.connection.host}`);
    } catch (error) {
        console.error("Connect to DB error: ", error.message);
        process.exit(1);
    }
}

export default connectDB;