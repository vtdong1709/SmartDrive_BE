import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  fullAddress: { type: String, required: true }, // Địa chỉ đầy đủ
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    }
  }
}, { _id: false });

// const paymentMethodSchema = new mongoose.Schema({
//     provider: { type: String, required: true, enum: ['momo', 'vnpay', 'paypal'] }, // Tên nhà cung cấp
//     customerId: { type: String, required: true }, // ID khách hàng từ nhà cung cấp
//     isDefault: { type: Boolean, default: false }
// }, { _id: false });


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
    telegramId: {
      type: String,
      default: null,
      sparse: true, // Cho phép null nhưng unique nếu có giá trị
    },
    telegramChatId: {
      type: String,
      default: null
    },
    telegramUsername: {
      type: String,
      default: null
    },
    
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["renter", "driver", "staff", "admin"],
      default: "renter",
    },
    verified: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String, // URL to the avatar image
    },
    
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    // Địa chỉ đã lưu để booking nhanh hơn
    savedAddresses: [addressSchema],
    
    // Phương thức thanh toán đã liên kết
    // paymentMethods: [paymentMethodSchema],

    // Liên kết tới hồ sơ tài xế (nếu user này là tài xế)
    driverProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriverProfile', // TODO: Gán model DriverProfile
      default: null,
    },
  },
  { timestamps: true }
);

// Index cho location để tìm kiếm địa lý nhanh hơn
userSchema.index({ 'savedAddresses.location': '2dsphere' });

const User = mongoose.model("users", userSchema);

export default User;