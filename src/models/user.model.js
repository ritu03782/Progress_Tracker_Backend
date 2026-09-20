import mongoose ,{Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const userSchema = new Schema({
    username:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        index:true
    },
    email:{
        type:String,
        required:[true,"Email is required"],
        unique:true,
        lowercase:true,
        trim:true,
    },
    fullName:{
        type:String,
        required:true,
        trim:true,
        index:true
    },
    avatar:{
        type:String,
        default:""
    },
    password:{
        type:String,
        required:[true,'Password is required']
    },
    refreshToken:{
        type:String
    },
    lastLogin:{
        type:Date
    },

    // --- Profile fields (used by the Profile page) ---
    course:{
        type:String,
        trim:true,
        default:""
    },
    college:{
        type:String,
        trim:true,
        default:""
    },
    graduationYear:{
        type:Number
    },
    dob:{
        type:Date
    },
    location:{
        type:String,
        trim:true,
        default:""
    },
    about:{
        type:String,
        trim:true,
        default:""
    },

    // --- Preferences (used by the Settings page) ---
    notifications:{
        type:Boolean,
        default:true
    },
    studyReminders:{
        type:Boolean,
        default:true
    },
    goalReminders:{
        type:Boolean,
        default:true
    }
},{
    timestamps:true
})

userSchema.pre("save", async function() {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10);
});
userSchema.methods.isPasswordCorrect=async function (password){
    return await bcrypt.compare(password,this.password)
}
userSchema.methods.generateAccessToken=function(){
    return jwt.sign(
        {
            _id:this._id,
            email:this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken=function(){
     return jwt.sign(
        {
            _id:this._id,

        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}
export const User = mongoose.model("User",userSchema);
