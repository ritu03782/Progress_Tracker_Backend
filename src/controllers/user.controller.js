import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
}

const generateAccessAndRefreshToken=async(user_id)=>{
    try{
    const user=await User.findById(user_id);
    const accessToken=user.generateAccessToken();
    const refreshToken=user.generateRefreshToken();
    user.refreshToken=refreshToken;
    await user.save({validateBeforeSave:false})
    return {accessToken,refreshToken};
}
    catch(error){
        throw new ApiError(500,"Something went wrong while generating access and refresh token");
    }
}

const registerUser = asyncHandler(
    async(req,res)=>{
        //get user details from frontend
        //validation - not empty
        //check if user already exists: username, email
        //check for optional avatar image, upload to cloudinary if present
        //create user object - create entry in db
        //remove password and refresh token field from response
        //return response

        const {username, email, fullName, password}=req.body
        if([fullName,email,username,password].some((field)=>field?.trim()===undefined || field?.trim()==="")){
            throw new ApiError(400,"All fields are required");
        }
        const existedUser= await User.findOne({
            $or:[{username:username.toLowerCase()}, {email}]
        })
        if(existedUser){
            throw new ApiError(409,"User with email or username already exists")
        }

        // Avatar is optional — only upload if the frontend actually sent one.
        const avatarLocalPath = req.file?.path;
        let avatar = { url: "" };
        if(avatarLocalPath){
            const uploaded = await uploadOnCloudinary(avatarLocalPath);
            if(uploaded) avatar = uploaded;
        }

        const user = await User.create({
            fullName,
            avatar:avatar.url||"",
            email,
            password,
            username:username.toLowerCase(),
            lastLogin: new Date(),
        })
        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )
        if(!createdUser){
            throw new ApiError(500,"Something went wrong while registering the user")
        }

        const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);

        return res
        .status(201)
        .cookie("accessToken",accessToken,cookieOptions)
        .cookie("refreshToken",refreshToken,cookieOptions)
        .json(
            new ApiResponse(201,{user:createdUser,accessToken},"User registered successfully")
        )
    }
)

// login User
const loginUser = asyncHandler(async(req,res)=>{
    const {username,email,password}=req.body;

    if((!username || !username.trim()) && (!email || !email.trim())){
        throw new ApiError(400,"Please enter your username or email.");
    }
    if(!password){
        throw new ApiError(400,"Please enter your password.")
    }

    const user= await User.findOne({
        $or:[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"No account found with this username or email.")
    }

    const isPasswordValid= await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401,"Incorrect password. Please try again.")
    }

    // Track last login for the Account Info card
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    return res
    .status(200)
    .cookie("accessToken",accessToken,cookieOptions)
    .cookie("refreshToken",refreshToken,cookieOptions)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,
                accessToken
            },
            "User logged In Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req,res)=>{
   await User.findByIdAndUpdate(req.user._id,
    {
        $unset:{
            refreshToken:1
        }
    },
    {
        new :true
    }
   )
   return res.status(200)
   .clearCookie("accessToken",cookieOptions)
   .clearCookie("refreshToken",cookieOptions)
   .json(new ApiResponse(200,{},"User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, refreshToken:newRefreshToken } = await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", newRefreshToken, cookieOptions)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully"
                )
            );

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if(!oldPassword || !newPassword){
        throw new ApiError(400,"Old and new password are required");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Password!! Enter Correct Password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser=asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"Current user fetched successfully"));
});

const updateAccountDetails=asyncHandler(async(req,res)=>{
     const {fullName,email,course,college,graduationYear,dob,location,about}=req.body;
     if(!fullName || !email){
        throw new ApiError(400,"Full name and email are required");
     }
     const updateFields = {
        fullName,
        email,
        ...(course !== undefined && {course}),
        ...(college !== undefined && {college}),
        ...(graduationYear !== undefined && {graduationYear}),
        ...(dob !== undefined && {dob}),
        ...(location !== undefined && {location}),
        ...(about !== undefined && {about}),
     };
     const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
             $set:updateFields
        },
        {new :true, runValidators:true}
     ).select("-password -refreshToken");
     return res
     .status(200)
     .json(new ApiResponse(200,user,"Account details updated successfully"))
});

const updatePreferences=asyncHandler(async(req,res)=>{
     const {notifications,studyReminders,goalReminders}=req.body;
     const updateFields = {
        ...(notifications !== undefined && {notifications: Boolean(notifications)}),
        ...(studyReminders !== undefined && {studyReminders: Boolean(studyReminders)}),
        ...(goalReminders !== undefined && {goalReminders: Boolean(goalReminders)}),
     };
     const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
             $set:updateFields
        },
        {new :true, runValidators:true}
     ).select("-password -refreshToken");
     return res
     .status(200)
     .json(new ApiResponse(200,user,"Preferences updated successfully"))
});

const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing");
    }

    // Grab the current avatar URL BEFORE overwriting it, so we know what to
    // delete from Cloudinary once the new one is safely uploaded and saved.
    const previousAvatarUrl = req.user?.avatar;

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar?.url){
       throw new ApiError(400,"Error while uploading avatar")
    }
    const user=await User.findByIdAndUpdate(req.user._id,
        {
        $set:{
             avatar:avatar.url
           }
        },
        {new:true}).select("-password -refreshToken")

    // Only delete the old avatar AFTER the new one is uploaded and the DB
    // record is updated — this way, if either step above had failed, the
    // user's existing avatar is never lost.
    if(previousAvatarUrl){
        await deleteFromCloudinary(previousAvatarUrl);
    }

     return res
        .status(200)
        .json(new ApiResponse(200,user,"Avatar updated successfully"))
});

export  {registerUser,loginUser,logoutUser,refreshAccessToken,changeCurrentPassword,getCurrentUser,updateAccountDetails,updatePreferences,updateUserAvatar};
