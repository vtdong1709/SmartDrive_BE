import Pricing from "../models/Pricing.js";
import { formatCurrency } from "../utils/formatCurrency.js";

/**
 * Mapping service type sang tên tiếng Việt
 */
const SERVICE_TYPE_NAMES = {
  per_km: "Theo km",
  hourly: "Theo giờ",
  daily: "Theo ngày",
  intercity: "Đi tỉnh (Liên tỉnh)",
};

/**
 * Lấy tên dịch vụ bằng tiếng Việt
 */
const getServiceTypeName = (serviceType) => {
  return SERVICE_TYPE_NAMES[serviceType] || serviceType;
};

/**
 * Lấy tất cả thông tin cần thiết từ database để chatbot trả lời
 */
export const getChatbotData = async () => {
  try {
    // Thông tin về SmartDrive
    const smartDriveInfo = {
      tên: "SmartDrive",
      môTả: "Ứng dụng cho thuê tài xế lái xe hộ.",
      tínhNăngChính: [
        "Thuê tài xế lái hộ",
        "Tìm tài xế di chuyển theo km, theo giờ, theo ngày, hoặc đi liên tỉnh",
        "Thanh toán trực tuyến hoặc trực tiếp cho tài xế",
        "Chat trực tiếp với tài xế trong suốt chuyến đi bằng hệ thống chat",
        "Theo dõi vị trí tài xế real-time",
      ],
      đốiTượng: [
        "Khách hàng cần thuê tài xế lái xe hộ để di chuyển",
        "Tài xế muốn đăng ký làm tài xế lái xe hộ trên nền tảng",
      ],
    };
    // Lấy tất cả bảng giá
    const pricings = await Pricing.find({
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: new Date() } },
      ],
    }).sort({ serviceType: 1 });

    // Format bảng giá để dễ đọc
    const pricingInfo = pricings.map((pricing) => {
      const info = {
        loạiDịchVụ: getServiceTypeName(pricing.serviceType), // Dùng tên tiếng Việt
        loạiDịchVụCode: pricing.serviceType, // Giữ code để tham chiếu
        phíMởCửa: formatCurrency(pricing.baseFare),
        phíNềnTảng: formatCurrency(pricing.platformFee),
        phíChờ: `${formatCurrency(pricing.waitingFeePerMin)}/phút`,
      };

      // Bảng giá theo km (per_km, intercity)
      if (pricing.fareBrackets && pricing.fareBrackets.length > 0) {
        info.bảngGiáTheoKm = pricing.fareBrackets.map((bracket) => {
          if (bracket.to === null) {
            return `Từ ${bracket.from}km trở đi: ${formatCurrency(bracket.pricePerKm)}/km`;
          }
          return `${bracket.from}km - ${bracket.to}km: ${formatCurrency(bracket.pricePerKm)}/km`;
        });
      }

      // Bảng giá theo giờ (hourly)
      if (pricing.hourBrackets && pricing.hourBrackets.length > 0) {
        info.bảngGiáTheoGiờ = pricing.hourBrackets.map((bracket) => {
          if (bracket.toHour === null) {
            return `Từ giờ thứ ${bracket.fromHour} trở đi: ${formatCurrency(bracket.pricePerHour)}/giờ`;
          }
          return `Giờ ${bracket.fromHour} - ${bracket.toHour}: ${formatCurrency(bracket.pricePerHour)}/giờ`;
        });
        info.giớiHạnKmMỗiGiờ = `${pricing.maxKmPerHour}km/giờ`;
        info.phụPhíVượtGiớiHạn = `${formatCurrency(pricing.surchargePerKm)}/km vượt`;
      }

      // Bảng giá theo ngày (daily)
      if (pricing.dayBrackets && pricing.dayBrackets.length > 0) {
        info.bảngGiáTheoNgày = pricing.dayBrackets.map((bracket) => {
          if (bracket.toDay === null) {
            return `Từ ngày thứ ${bracket.fromDay} trở đi: ${formatCurrency(bracket.pricePerDay)}/ngày`;
          }
          return `Ngày ${bracket.fromDay} - ${bracket.toDay}: ${formatCurrency(bracket.pricePerDay)}/ngày`;
        });
        info.giớiHạnKmMỗiNgày = `${pricing.maxKmPerDay}km/ngày`;
      }

      // Phí quay đầu (intercity)
      if (pricing.turnBackFees && pricing.turnBackFees.length > 0) {
        info.phíQuayĐầu = pricing.turnBackFees.map((fee) => {
          if (fee.toKm === null) {
            return `Từ ${fee.fromKm}km trở đi: ${formatCurrency(fee.fee)}`;
          }
          return `${fee.fromKm}km - ${fee.toKm}km: ${formatCurrency(fee.fee)}`;
        });
      }

      // Hệ số nhân phụ phí
      if (pricing.multipliers) {
        info.hệSốNhânPhụPhí = {
          sau21h: pricing.multipliers.after21h,
          sau23h: pricing.multipliers.after23h,
          cuốiTuần: pricing.multipliers.weekend,
          ngàyLễ: pricing.multipliers.holiday,
        };
      }

      return info;
    });

    // Thông tin đăng ký
    const registrationInfo = {
      yêuCầu: [
        "Họ và tên (bắt buộc)",
        "Email hợp lệ (bắt buộc, phải duy nhất)",
        "Số điện thoại Việt Nam (bắt buộc, định dạng: 0xxxxxxxxx hoặc +84xxxxxxxxx)",
        "Mật khẩu (bắt buộc, tối thiểu 6 ký tự)",
      ],
      quyTrình: [
        "1. Điền đầy đủ thông tin: họ tên, email, số điện thoại, mật khẩu",
        "2. Hệ thống sẽ gửi mã OTP đến email của bạn",
        "3. Nhập mã OTP để xác thực email",
        "4. Sau khi xác thực thành công, bạn có thể đăng nhập và sử dụng ứng dụng",
      ],
      lưuÝ: [
        "Email phải chưa được sử dụng trong hệ thống",
        "Số điện thoại phải đúng định dạng Việt Nam",
        "Mật khẩu phải có ít nhất 6 ký tự",
        "Bạn cần xác thực email trước khi có thể đăng nhập",
      ],
    };

    // Thông tin đăng nhập
    const loginInfo = {
      cáchĐăngNhập: [
        "1. Nhập số điện thoại đã đăng ký",
        "2. Nhập mật khẩu",
        "3. Nhấn nút 'Đăng nhập'",
      ],
      yêuCầu: [
        "Tài khoản phải đã được xác thực email (verified = true)",
        "Số điện thoại và mật khẩu phải chính xác",
      ],
      quênMậtKhẩu: [
        "1. Chọn 'Quên mật khẩu'",
        "2. Nhập email đã đăng ký",
        "3. Hệ thống sẽ gửi mã OTP đến email",
        "4. Nhập mã OTP và mật khẩu mới",
        "5. Đăng nhập lại với mật khẩu mới",
      ],
    };

    // Thông tin dịch vụ
    const serviceInfo = {
      cácLoạiDịchVụ: [
        {
          loại: "per_km",
          tên: "Theo km",
          môTả: "Thuê tài xế lái xe hộ tính phí theo số km di chuyển",
        },
        {
          loại: "hourly",
          tên: "Theo giờ",
          môTả: "Thuê tài xế lái xe hộ theo giờ, có giới hạn km/giờ",
        },
        {
          loại: "daily",
          tên: "Theo ngày",
          môTả: "Thuê tài xế lái xe hộ theo ngày, có giới hạn km/ngày",
        },
        {
          loại: "intercity",
          tên: "Đi tỉnh (Liên tỉnh)",
          môTả: "Thuê tài xế lái xe hộ đi liên tỉnh, có phí quay đầu",
        },
      ],
      phươngThứcThanhToán: [
        {
          loại: "system",
          tên: "Thanh toán qua hệ thống",
          môTả: "Thanh toán trực tuyến qua PayOS (QR code, chuyển khoản)",
        },
        {
          loại: "toDriver",
          tên: "Thanh toán cho tài xế",
          môTả: "Thanh toán trực tiếp cho tài xế khi kết thúc chuyến",
        },
      ],
      trạngTháiBooking: [
        "Pending - Đang chờ xác nhận",
        "Confirmed - Đã xác nhận",
        "Arriving - Tài xế đang đến",
        "Ongoing - Đang trong chuyến",
        "Completed - Đã hoàn thành",
        "Cancelled - Đã hủy",
      ],
    };

    // Thông tin trở thành tài xế
    const driverInfo = {
      yêuCầu: [
        "Đã có tài khoản người dùng",
        "Giấy phép lái xe hợp lệ (licenseNumber, licenseExpiry)",
        "Thông tin cá nhân: họ tên, số điện thoại, email, số CMND/CCCD",
        "Địa chỉ: tỉnh/thành phố, quận/huyện, phường/xã, địa chỉ cụ thể",
        "Kinh nghiệm lái xe (yearsExperience >= 0)",
        "Các loại dịch vụ muốn cung cấp (ít nhất 1 loại)",
        "Giấy tờ: mặt trước/sau CMND/CCCD (idFrontUrl, idBackUrl), mặt trước/sau bằng lái xe (driverLicenseFrontUrl, driverLicenseBackUrl)",
      ],
      quyTrình: [
        "1. Đăng ký tài khoản (nếu chưa có)",
        "2. Điền đơn đăng ký làm tài xế với đầy đủ thông tin",
        "3. Upload các giấy tờ cần thiết (CMND/CCCD, bằng lái xe)",
        "4. Chọn các loại dịch vụ muốn cung cấp",
        "5. Nộp đơn (status chuyển từ 'draft' sang 'pending')",
        "6. Chờ admin/staff xét duyệt",
        "7. Nhận email thông báo kết quả (duyệt/từ chối)",
        "8. Nếu được duyệt (status = 'approved'): tài khoản chuyển thành role 'driver', driverProfile.approved = true",
        "9. Nếu bị từ chối (status = 'rejected'): nhận lý do từ chối qua email",
      ],
      trạngTháiĐơn: [
        "draft - Nháp, chưa nộp",
        "pending - Đã nộp, đang chờ xét duyệt",
        "approved - Đã được duyệt",
        "rejected - Bị từ chối (có lý do rejectionReason)",
      ],
      loạiDịchVụCóThểCungCấp: [
        "dich_vu_tai_xe_theo_gio - Dịch vụ tài xế theo giờ",
        "dich_vu_tai_xe_theo_cay_so - Dịch vụ tài xế theo cây số",
        "dich_vu_tai_xe_theo_ngay - Dịch vụ tài xế theo ngày",
        "dich_vu_tai_xe_lien_tinh - Dịch vụ tài xế liên tỉnh",
      ],
    };

    // Thông tin đặt xe (booking)
    const bookingInfo = {
      cáchĐặtXe: [
        "1. Đăng nhập vào ứng dụng",
        "2. Chọn loại dịch vụ: Theo km, Theo giờ, Theo ngày, hoặc Đi tỉnh",
        "3. Nhập điểm đón - bắt buộc",
        "4. Nhập điểm đến - bắt buộc cho 'Theo km' và 'Đi tỉnh', không cần cho 'Theo giờ' và 'Theo ngày'",
        "5. Chọn thời gian bắt đầu - bắt buộc",
        "6. Chọn thời gian kết thúc - bắt buộc cho 'Theo giờ' và 'Theo ngày', không cần cho 'Theo km' và 'Đi tỉnh'",
        "7. Hệ thống sẽ tính giá và tìm tài xế gần nhất",
        "8. Chọn phương thức thanh toán (qua hệ thống hoặc trực tiếp cho tài xế)",
        "9. Xác nhận tìm tài xế lái xe hộ.",
        "10. Chờ tài xế nhận chuyến",
      ],
      yêuCầuTheoLoạiDịchVụ: [
        {
          loại: "Theo km",
          yêuCầu: ["Điểm đón (bắt buộc)", "Điểm đến (bắt buộc)", "Thời gian bắt đầu (bắt buộc)", "Không cần thời gian kết thúc"],
        },
        {
          loại: "Đi tỉnh (Liên tỉnh)",
          yêuCầu: ["Điểm đón (bắt buộc)", "Điểm đến (bắt buộc)", "Thời gian bắt đầu (bắt buộc)", "Không cần thời gian kết thúc"],
        },
        {
          loại: "Theo giờ",
          yêuCầu: ["Điểm đón (bắt buộc)", "Thời gian bắt đầu (bắt buộc)", "Thời gian kết thúc (bắt buộc, tối đa 8 giờ)", "Không cần điểm đến"],
        },
        {
          loại: "Theo ngày",
          yêuCầu: ["Điểm đón (bắt buộc)", "Thời gian bắt đầu (bắt buộc)", "Thời gian kết thúc (bắt buộc, tối đa 3 ngày)", "Không cần điểm đến"],
        },
      ],
      mãBooking: {
        địnhDạng: "BK<YYMMDD><increment>",
        víDụ: "BK2510040005 (booking thứ 5 ngày 2025-10-04)",
        giảiThích: "Mỗi booking sẽ có mã duy nhất tự động tạo khi đặt xe",
      },
      trạngTháiBooking: [
        {
          trạngThái: "Pending",
          môTả: "Đang chờ xác nhận - Booking vừa được tạo, đang chờ tài xế nhận chuyến",
        },
        {
          trạngThái: "Confirmed",
          môTả: "Đã xác nhận - Tài xế đã nhận chuyến, có thể bắt đầu chat với tài xế",
        },
        {
          trạngThái: "Arriving",
          môTả: "Tài xế đang đến - Tài xế đang trên đường đến điểm đón",
        },
        {
          trạngThái: "Ongoing",
          môTả: "Đang trong chuyến - Chuyến đi đã bắt đầu",
        },
        {
          trạngThái: "Completed",
          môTả: "Đã hoàn thành - Chuyến đi đã kết thúc, có thể đánh giá tài xế",
        },
        {
          trạngThái: "Cancelled",
          môTả: "Đã hủy - Booking đã bị hủy bởi khách hàng hoặc tài xế",
        },
      ],
      chatVớiTàiXế: [
        "Chỉ có thể chat khi booking ở trạng thái: Confirmed, Arriving, hoặc Ongoing",
        "Chat tự động kết thúc khi booking Completed hoặc Cancelled",
        "Cả khách hàng và tài xế đều có thể gửi tin nhắn",
      ],
    };

    // Thông tin thanh toán
    const paymentInfo = {
      phươngThứcThanhToán: [
        {
          loại: "system",
          tên: "Thanh toán qua hệ thống",
          môTả: "Thanh toán trực tuyến qua PayOS",
          cáchThức: [
            "Hệ thống tạo link thanh toán hoặc QR code",
            "Khách hàng quét QR hoặc chuyển khoản",
            "Sau khi thanh toán thành công, booking status chuyển sang 'Confirmed'",
            "Tài xế nhận 85% giá trị chuyến (hệ thống trừ 15% hoa hồng)",
          ],
        },
        {
          loại: "toDriver",
          tên: "Thanh toán cho tài xế",
          môTả: "Thanh toán trực tiếp cho tài xế khi kết thúc chuyến",
          cáchThức: [
            "Khách hàng thanh toán trực tiếp cho tài xế",
            "Tài xế có nợ hoa hồng 15% trong ví (debt)",
            "Tài xế cần thanh toán nợ này cho hệ thống",
          ],
        },
      ],
      trạngTháiThanhToán: [
        {
          trạngThái: "Pending",
          môTả: "Chưa thanh toán - Booking mới tạo, chưa thanh toán",
        },
        {
          trạngThái: "Paid",
          môTả: "Đã thanh toán - Đã thanh toán thành công",
        },
        {
          trạngThái: "Failed",
          môTả: "Thanh toán thất bại - Giao dịch thanh toán không thành công",
        },
      ],
      hoaHồngTàiXế: {
        tỷLệ: "15%",
        cáchTính: "Hệ thống trừ 15% từ giá trị chuyến làm hoa hồng",
        tàiXếNhận: "85% giá trị chuyến",
        víDụ: "Chuyến 1.000.000₫ → Hoa hồng: 150.000₫ → Tài xế nhận: 850.000₫",
      },
    };

    // Thông tin ví tài xế
    const walletInfo = {
      cácLoạiSốDư: [
        {
          loại: "balance",
          môTả: "Số dư khả dụng - Tiền có thể rút ngay",
        },
        {
          loại: "debt",
          môTả: "Nợ hoa hồng - Tiền nợ hệ thống từ các chuyến thanh toán trực tiếp (toDriver)",
        },
        {
          loại: "totalEarnings",
          môTả: "Tổng thu nhập - Tổng số tiền đã kiếm được từ tất cả các chuyến",
        },
        {
          loại: "totalWithdrawn",
          môTả: "Tổng đã rút - Tổng số tiền đã rút về tài khoản ngân hàng",
        },
      ],
      rútTiền: [
        "Tài xế có thể rút tiền từ balance về tài khoản ngân hàng",
        "Cần có thông tin tài khoản ngân hàng (bankAccount.numberBank, bankAccount.bankName)",
        "Ví có thể bị khóa (isLocked = true) nếu nợ vượt hạn hoặc gian lận",
      ],
    };

    // FAQ thường gặp
    const faqInfo = {
      câuHỏiThườngGặp: [
        {
          câuHỏi: "Làm sao để hủy booking?",
          trảLời: "Bạn có thể hủy booking trước khi tài xế nhận chuyến (status = Pending). Sau khi tài xế đã nhận (Confirmed trở đi), vui lòng liên hệ tài xế hoặc nhân viên hỗ trợ.",
        },
        {
          câuHỏi: "Tôi có thể thay đổi điểm đón/điểm đến sau khi đặt xe không?",
          trảLời: "Sau khi booking đã được xác nhận, vui lòng liên hệ trực tiếp với tài xế qua tính năng chat trong app để thỏa thuận.",
        },
        {
          câuHỏi: "Làm sao để thanh toán?",
          trảLời: "Bạn có thể chọn thanh toán qua hệ thống (QR code/chuyển khoản) hoặc thanh toán trực tiếp cho tài xế khi kết thúc chuyến.",
        },
        {
          câuHỏi: "Tài xế nhận được bao nhiêu tiền?",
          trảLời: "Tài xế nhận 85% giá trị chuyến, hệ thống trừ 15% làm hoa hồng.",
        },
        {
          câuHỏi: "Tôi có thể chat với tài xế không?",
          trảLời: "Có, bạn có thể chat với tài xế khi booking ở trạng thái Confirmed, Arriving hoặc Ongoing. Chat tự động kết thúc khi booking Completed hoặc Cancelled.",
        },
        {
          câuHỏi: "Làm sao để trở thành tài xế?",
          trảLời: "Bạn cần đăng ký tài khoản, nộp đơn đăng ký làm tài xế với đầy đủ thông tin và giấy tờ, sau đó chờ admin xét duyệt.",
        },
        {
          câuHỏi: "Mất bao lâu để được duyệt đơn làm tài xế?",
          trảLời: "Thời gian xét duyệt phụ thuộc vào admin/staff, thường từ 1-3 ngày làm việc. Bạn sẽ nhận email thông báo kết quả.",
        },
        {
          câuHỏi: "Tôi quên mật khẩu thì làm sao?",
          trảLời: "Chọn 'Quên mật khẩu', nhập email đã đăng ký, hệ thống sẽ gửi mã OTP. Nhập mã OTP và mật khẩu mới, sau đó đăng nhập lại.",
        },
      ],
    };

    return {
      thôngTinSmartDrive: smartDriveInfo,
      bảngGiá: pricingInfo,
      thôngTinĐăngKý: registrationInfo,
      thôngTinĐăngNhập: loginInfo,
      thôngTinDịchVụ: serviceInfo,
      thôngTinTàiXế: driverInfo,
      thôngTinĐặtXe: bookingInfo,
      thôngTinThanhToán: paymentInfo,
      thôngTinVíTàiXế: walletInfo,
      câuHỏiThườngGặp: faqInfo,
    };
  } catch (error) {
    console.error("Error getting chatbot data:", error);
    // Trả về dữ liệu mặc định nếu có lỗi
    return {
      bảngGiá: [],
      thôngTinĐăngKý: {
        yêuCầu: ["Họ tên", "Email", "Số điện thoại", "Mật khẩu"],
        quyTrình: ["Điền thông tin", "Xác thực email", "Hoàn tất"],
      },
      thôngTinĐăngNhập: {
        cáchĐăngNhập: ["Nhập số điện thoại và mật khẩu"],
      },
      thôngTinDịchVụ: {
        cácLoạiDịchVụ: ["per_km", "hourly", "daily", "intercity"],
      },
      thôngTinSmartDrive: {
        tên: "SmartDrive",
        môTả: "Ứng dụng cho thuê tài xế lái xe hộ",
        tínhNăngChính: ["Thuê tài xế lái xe hộ"],
      },
      thôngTinTàiXế: {
        yêuCầu: ["Giấy phép lái xe", "Thông tin phương tiện"],
      },
      thôngTinĐặtXe: {
        cáchĐặtXe: ["Đăng nhập", "Chọn dịch vụ", "Nhập thông tin", "Xác nhận"],
      },
      thôngTinThanhToán: {
        phươngThứcThanhToán: ["system", "toDriver"],
      },
      thôngTinVíTàiXế: {
        cácLoạiSốDư: ["balance", "debt", "totalEarnings"],
      },
      câuHỏiThườngGặp: {
        câuHỏiThườngGặp: [],
      },
    };
  }
};

/**
 * Format dữ liệu thành text để đưa vào prompt
 */
export const formatChatbotDataForPrompt = async () => {
  const data = await getChatbotData();
  
  let prompt = `\n\n=== THÔNG TIN CHÍNH XÁC TỪ DATABASE ===\n\n`;
  
  // Thông tin về SmartDrive
  if (data.thôngTinSmartDrive) {
    prompt += `\n## SMARTDRIVE LÀ GÌ:\n`;
    prompt += `- Tên: ${data.thôngTinSmartDrive.tên}\n`;
    prompt += `- Mô tả: ${data.thôngTinSmartDrive.môTả}\n`;
    prompt += `- Tính năng chính:\n`;
    data.thôngTinSmartDrive.tínhNăngChính.forEach((feature) => {
      prompt += `  + ${feature}\n`;
    });
    prompt += `- Đối tượng sử dụng:\n`;
    data.thôngTinSmartDrive.đốiTượng.forEach((obj) => {
      prompt += `  + ${obj}\n`;
    });
  }
  
  // Bảng giá
  if (data.bảngGiá && data.bảngGiá.length > 0) {
    prompt += `\n## BẢNG GIÁ DỊCH VỤ:\n`;
    prompt += `LƯU Ý: Khi trả lời về bảng giá, bạn PHẢI dùng tên dịch vụ bằng tiếng Việt: "Theo km", "Theo giờ", "Theo ngày", "Đi tỉnh" thay vì dùng code như "per_km", "hourly", "daily", "intercity".\n\n`;
    data.bảngGiá.forEach((pricing, index) => {
      prompt += `\n### Dịch vụ ${index + 1}: ${pricing.loạiDịchVụ}\n`;
      prompt += `- Phí mở cửa: ${pricing.phíMởCửa}\n`;
      prompt += `- Phí nền tảng: ${pricing.phíNềnTảng}\n`;
      prompt += `- Phí chờ: ${pricing.phíChờ}\n`;
      
      if (pricing.bảngGiáTheoKm) {
        prompt += `- Bảng giá theo km:\n`;
        pricing.bảngGiáTheoKm.forEach((item) => {
          prompt += `  + ${item}\n`;
        });
      }
      
      if (pricing.bảngGiáTheoGiờ) {
        prompt += `- Bảng giá theo giờ:\n`;
        pricing.bảngGiáTheoGiờ.forEach((item) => {
          prompt += `  + ${item}\n`;
        });
        prompt += `- Giới hạn: ${pricing.giớiHạnKmMỗiGiờ}\n`;
        prompt += `- Phụ phí vượt: ${pricing.phụPhíVượtGiớiHạn}\n`;
      }
      
      if (pricing.bảngGiáTheoNgày) {
        prompt += `- Bảng giá theo ngày:\n`;
        pricing.bảngGiáTheoNgày.forEach((item) => {
          prompt += `  + ${item}\n`;
        });
        prompt += `- Giới hạn: ${pricing.giớiHạnKmMỗiNgày}\n`;
      }
      
      if (pricing.phíQuayĐầu) {
        prompt += `- Phí quay đầu:\n`;
        pricing.phíQuayĐầu.forEach((item) => {
          prompt += `  + ${item}\n`;
        });
      }
      
      if (pricing.hệSốNhânPhụPhí) {
        prompt += `- Hệ số nhân phụ phí:\n`;
        prompt += `  + Sau 21h: ${pricing.hệSốNhânPhụPhí.sau21h}x\n`;
        prompt += `  + Sau 23h: ${pricing.hệSốNhânPhụPhí.sau23h}x\n`;
        prompt += `  + Cuối tuần: ${pricing.hệSốNhânPhụPhí.cuốiTuần}x\n`;
        prompt += `  + Ngày lễ: ${pricing.hệSốNhânPhụPhí.ngàyLễ}x\n`;
      }
    });
  }
  
  // Thông tin đăng ký
  prompt += `\n## CÁCH ĐĂNG KÝ:\n`;
  prompt += `Yêu cầu: ${data.thôngTinĐăngKý.yêuCầu.join(", ")}\n`;
  prompt += `Quy trình:\n${data.thôngTinĐăngKý.quyTrình.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n`;
  if (data.thôngTinĐăngKý.lưuÝ) {
    prompt += `Lưu ý:\n${data.thôngTinĐăngKý.lưuÝ.map((note) => `- ${note}`).join("\n")}\n`;
  }
  
  // Thông tin đăng nhập
  prompt += `\n## CÁCH ĐĂNG NHẬP:\n`;
  prompt += `Các bước:\n${data.thôngTinĐăngNhập.cáchĐăngNhập.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n`;
  if (data.thôngTinĐăngNhập.yêuCầu) {
    prompt += `Yêu cầu:\n${data.thôngTinĐăngNhập.yêuCầu.map((req) => `- ${req}`).join("\n")}\n`;
  }
  if (data.thôngTinĐăngNhập.quênMậtKhẩu) {
    prompt += `Quên mật khẩu:\n${data.thôngTinĐăngNhập.quênMậtKhẩu.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n`;
  }
  
  // Thông tin dịch vụ
  prompt += `\n## THÔNG TIN DỊCH VỤ:\n`;
  prompt += `LƯU Ý: Khi trả lời về dịch vụ, bạn PHẢI dùng tên tiếng Việt: "Theo km", "Theo giờ", "Theo ngày", "Đi tỉnh" thay vì dùng code như "per_km", "hourly", "daily", "intercity".\n\n`;
  if (data.thôngTinDịchVụ.cácLoạiDịchVụ) {
    prompt += `Các loại dịch vụ:\n`;
    data.thôngTinDịchVụ.cácLoạiDịchVụ.forEach((sv) => {
      prompt += `- ${sv.tên}: ${sv.môTả}\n`;
    });
  }
  if (data.thôngTinDịchVụ.phươngThứcThanhToán) {
    prompt += `Phương thức thanh toán:\n`;
    data.thôngTinDịchVụ.phươngThứcThanhToán.forEach((pt) => {
      prompt += `- ${pt.tên} (${pt.loại}): ${pt.môTả}\n`;
    });
  }
  if (data.thôngTinDịchVụ.trạngTháiBooking) {
    prompt += `Trạng thái booking:\n`;
    data.thôngTinDịchVụ.trạngTháiBooking.forEach((status) => {
      prompt += `- ${status}\n`;
    });
  }
  
  // Thông tin tài xế
  prompt += `\n## CÁCH TRỞ THÀNH TÀI XẾ:\n`;
  prompt += `Yêu cầu:\n${data.thôngTinTàiXế.yêuCầu.map((req) => `- ${req}`).join("\n")}\n`;
  prompt += `Quy trình:\n${data.thôngTinTàiXế.quyTrình.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n`;
  if (data.thôngTinTàiXế.trạngTháiĐơn) {
    prompt += `Trạng thái đơn:\n${data.thôngTinTàiXế.trạngTháiĐơn.map((status) => `- ${status}`).join("\n")}\n`;
  }
  if (data.thôngTinTàiXế.loạiDịchVụCóThểCungCấp) {
    prompt += `Các loại dịch vụ có thể cung cấp:\n`;
    data.thôngTinTàiXế.loạiDịchVụCóThểCungCấp.forEach((sv) => {
      prompt += `- ${sv}\n`;
    });
  }
  
  // Thông tin đặt xe
  if (data.thôngTinĐặtXe) {
    prompt += `\n## CÁCH ĐẶT XE:\n`;
    prompt += `Các bước:\n${data.thôngTinĐặtXe.cáchĐặtXe.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n`;
    if (data.thôngTinĐặtXe.yêuCầuTheoLoạiDịchVụ) {
      prompt += `Yêu cầu theo loại dịch vụ:\n`;
      data.thôngTinĐặtXe.yêuCầuTheoLoạiDịchVụ.forEach((item) => {
        prompt += `- ${item.loại}: ${item.yêuCầu.join(", ")}\n`;
      });
    }
    if (data.thôngTinĐặtXe.mãBooking) {
      prompt += `Mã booking:\n`;
      prompt += `- Định dạng: ${data.thôngTinĐặtXe.mãBooking.địnhDạng}\n`;
      prompt += `- Ví dụ: ${data.thôngTinĐặtXe.mãBooking.víDụ}\n`;
      prompt += `- ${data.thôngTinĐặtXe.mãBooking.giảiThích}\n`;
    }
    if (data.thôngTinĐặtXe.trạngTháiBooking) {
      prompt += `Trạng thái booking:\n`;
      data.thôngTinĐặtXe.trạngTháiBooking.forEach((status) => {
        prompt += `- ${status.trạngThái}: ${status.môTả}\n`;
      });
    }
    if (data.thôngTinĐặtXe.chatVớiTàiXế) {
      prompt += `Chat với tài xế:\n`;
      data.thôngTinĐặtXe.chatVớiTàiXế.forEach((info) => {
        prompt += `- ${info}\n`;
      });
    }
  }
  
  // Thông tin thanh toán
  if (data.thôngTinThanhToán) {
    prompt += `\n## THÔNG TIN THANH TOÁN:\n`;
    if (data.thôngTinThanhToán.phươngThứcThanhToán) {
      prompt += `Phương thức thanh toán:\n`;
      data.thôngTinThanhToán.phươngThứcThanhToán.forEach((pt) => {
        prompt += `- ${pt.tên} (${pt.loại}): ${pt.môTả}\n`;
        if (pt.cáchThức) {
          pt.cáchThức.forEach((step, i) => {
            prompt += `  ${i + 1}. ${step}\n`;
          });
        }
      });
    }
    if (data.thôngTinThanhToán.trạngTháiThanhToán) {
      prompt += `Trạng thái thanh toán:\n`;
      data.thôngTinThanhToán.trạngTháiThanhToán.forEach((status) => {
        prompt += `- ${status.trạngThái}: ${status.môTả}\n`;
      });
    }
    if (data.thôngTinThanhToán.hoaHồngTàiXế) {
      prompt += `Hoa hồng tài xế:\n`;
      prompt += `- Tỷ lệ: ${data.thôngTinThanhToán.hoaHồngTàiXế.tỷLệ}\n`;
      prompt += `- Cách tính: ${data.thôngTinThanhToán.hoaHồngTàiXế.cáchTính}\n`;
      prompt += `- Tài xế nhận: ${data.thôngTinThanhToán.hoaHồngTàiXế.tàiXếNhận}\n`;
      prompt += `- Ví dụ: ${data.thôngTinThanhToán.hoaHồngTàiXế.víDụ}\n`;
    }
  }
  
  // Thông tin ví tài xế
  if (data.thôngTinVíTàiXế) {
    prompt += `\n## THÔNG TIN VÍ TÀI XẾ:\n`;
    if (data.thôngTinVíTàiXế.cácLoạiSốDư) {
      prompt += `Các loại số dư:\n`;
      data.thôngTinVíTàiXế.cácLoạiSốDư.forEach((item) => {
        prompt += `- ${item.loại}: ${item.môTả}\n`;
      });
    }
    if (data.thôngTinVíTàiXế.rútTiền) {
      prompt += `Rút tiền:\n`;
      data.thôngTinVíTàiXế.rútTiền.forEach((info) => {
        prompt += `- ${info}\n`;
      });
    }
  }
  
  // FAQ
  if (data.câuHỏiThườngGặp && data.câuHỏiThườngGặp.câuHỏiThườngGặp) {
    prompt += `\n## CÂU HỎI THƯỜNG GẶP:\n`;
    data.câuHỏiThườngGặp.câuHỏiThườngGặp.forEach((faq) => {
      prompt += `Q: ${faq.câuHỏi}\n`;
      prompt += `A: ${faq.trảLời}\n\n`;
    });
  }
  
  prompt += `\n=== KẾT THÚC THÔNG TIN DATABASE ===\n\n`;
  
  return prompt;
};

