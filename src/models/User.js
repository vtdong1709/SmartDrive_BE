import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    role: {
      type: String,
      enum: ["renter", "staff", "admin"],
      default: "renter",
    },
    verified: {
      type: Boolean,
      default: false,
    },

    avatar: {
      type: String,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("users", userSchema);

export default User;
