import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
const connectDB=async ()=>{try{
    const connectionInstance = await mongoose.connect(
    process.env.MONGODB_URI
    );
    console.log(`Mongoose connected : ${connectionInstance.connection.host} `);
}
catch(error){
  console.log(`Unable to connect to the MongoDB !! ${error}`);
  process.exit(1);
}
}
export default connectDB;