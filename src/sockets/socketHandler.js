import crypto from "crypto";
import { setMyAvailabilityService, updateDriverLocation } from "../services/driverApplicationService.js";
import { getUserById } from "../services/userService.js";
import redis from "../redis.js";
import { sendNotification } from "../services/notificationService.js";
import Booking from "../models/Booking.js";
import {formatCurrency} from "../utils/formatCurrency.js";
import { timeStamp } from "console";
import { sendMessageService } from "../services/chatService.js";
import ChatMessage from "../models/ChatMessage.js";

// Lưu trữ tạm thời (in-memory)
const onlineDrivers = new Map(); // driverId -> { socketId, location, lastSeen }
const pendingRequests = new Map(); // requestId -> { queue, currentIndex, timerId, data, customerSocketId }

export function setupSocket(io) {
  console.log("Socket.IO initialized");

  io.on("connection", (socket) => {
    console.log(`New socket connected: ${socket.id}`);
    
    // Lưu userId vào socket để dùng sau này
    socket.userId = null;

    //Khi tài xế online
    socket.on("driverOnline", async (data) => {
      const { driverId, lat, lng } = data;

      onlineDrivers.set(driverId, {
        socketId: socket.id,
        location: { lat, lng },
        lastSeen: Date.now(),
      });

      // Lưu vào Redis (để API cũng thấy)
    await redis.set(
      `driver:${driverId}`,
      JSON.stringify({
        location: { lat, lng },
        availability: "online",
        lastSeen: Date.now(),
      })
    );
    console.log(`Driver ${driverId} is now online`);
    });

    //Tài xế cập nhật vị trí
    socket.on("driverLocationUpdate", async ({ driverId, lat, lng }) => {
      if (!driverId) return;
      await updateDriverLocation(driverId, lat, lng);
      // Cập nhật vào Redis
      const existing = await redis.get(`driver:${driverId}`);
      if (existing) {
        const info = JSON.parse(existing);
        info.lat = lat;
        info.lng = lng;
        info.timestamp = Date.now();
        await redis.set(`driver:${driverId}`, JSON.stringify(info));
      }

      // Cập nhật trong map (để tính distance real-time)
      if (onlineDrivers.has(driverId)) {
        onlineDrivers.get(driverId).location = { lat, lng };
      }

      // realtime location cho khách hàng
      io.emit("driverLocationUpdate", { driverId, location: { lat, lng } });
    });

    // Khi tài xế tắt online
    socket.on("driverOffline", async ({ driverId }) => {
      console.log(`Driver ${driverId} went offline`);
      await setMyAvailabilityService(driverId, false);
      onlineDrivers.delete(driverId);
      await redis.del(`driver:${driverId}`);
    });

    // Listen for booking acceptance confirmation
// socket.on("bookingYouAccepted", async (payload) => {
//   // Navigate with correct bookingId from renter
//   router.push({
//     pathname: "/(booking)/move-driver",
//     params: {
//       bookingId: payload.bookingId || "",
//       // ... other params
//     },
//   });
// });

// Khi renter tạo booking xong và gửi bookingId
socket.on("bookingCreated", ({ requestId, bookingId }) => {
  const reqObj = pendingRequests.get(requestId);
  if (!reqObj || !reqObj.waitingForBookingId) return;

  const current = reqObj.queue[reqObj.currentIndex];
  if (!current) return;

  // Send bookingId to driver
  io.to(current.socketId).emit("bookingYouAccepted", { 
    success: true, 
    bookingId: bookingId 
  });
  
  pendingRequests.delete(requestId);
});

    // Khi khách hàng nhấn "Tìm tài xế"
    socket.on("findDriver", async (data) => {
      console.log("Received findDriver event from FE:", data);

      if (onlineDrivers.size === 0) {
        const keys = await redis.keys("driver:*");
        for (const key of keys) {
          const driverId = key.split(":")[1];
          const info = await redis.get(key);
          if (info) {
            const parsed = JSON.parse(info);
            onlineDrivers.set(driverId, {
              socketId: null, // chưa có socket cụ thể
              location: parsed.location || { lat: 0, lng: 0 },
              lastSeen: parsed.lastSeen,
            });
          }
        }
        console.log(`Reloaded ${onlineDrivers.size} drivers from Redis`);
      }
    
      const { customerId, pickupLocation, dropoffLocation, finalFare ,serviceType, startTime, endTime, paymentMethod, paymentStatus } = data;
      const customerSocketId = socket.id;
      
      // Lấy thông tin khách hàng
      let customerInfo = null;
      try {
        console.log("customerInfo", customerInfo)
        customerInfo = await getUserById(customerId);
        console.log(`Customer info loaded: ${customerInfo.fullName}`);
      } catch (error) {
        console.error(`Error loading customer info for ${customerId}:`, error.message);
        // Vẫn tiếp tục với thông tin cơ bản
        customerInfo = { _id: customerId, fullName: "Khách hàng", phone: "" };
      }
      
      console.log(`Checking ${onlineDrivers.size} online drivers...`);
      //Lọc danh sách tài xế gần điểm đón
      const nearbyDrivers = [];
      if (serviceType === 'hourly' || serviceType === 'daily') {
        const MAX_DISTANCE_KM = 20;
        for (const [driverId, info] of onlineDrivers.entries()) {
             const distance = calculateDistance(
                pickupLocation.lat,
                pickupLocation.lng,
                info.location.lat,
                info.location.lng
              );
              console.log("distance", distance.toFixed(2));
            if (distance <= MAX_DISTANCE_KM && info.socketId) {
              const activeBooking = await Booking.findOne({
                driverId,
                status: { $in: ["Pending", "Confirmed", "Arriving", "Ongoing"] },
              });
            
              if (activeBooking) {
                console.log(`Driver ${driverId} is busy with booking ${activeBooking._id}`);
                continue; // bỏ qua tài xế này
              }
            
                console.log(` Driver ${driverId} is within ${distance.toFixed(2)} km for ${serviceType} booking`);
                nearbyDrivers.push({ driverId, socketId: info.socketId });
            }
        }

        if (nearbyDrivers.length === 0) {
          console.log("No nearby drivers found for", customerId);
          io.to(customerSocketId).emit("noDriverAvailable", {
            message: "Không có tài xế nào gần bạn vào lúc này.",
          });
  
          // gửi notification realtime + lưu DB (nếu muốn lưu cho customer) - dùng sendNotification
          try {
            await sendNotification(io, {
              userId: customerId,
              title: "Không tìm thấy tài xế",
              message: "Xin lỗi, hiện chưa có tài xế khả dụng gần bạn. Vui lòng thử lại sau.",
              type: "warning",
              meta: { pickupLocation, serviceType },
            });
          } catch (err) {
            console.error("Failed to send 'no driver' notification:", err?.message || err);
          }
          return;
        }
        console.log(`Found ${nearbyDrivers.length} drivers within ${MAX_DISTANCE_KM} km for ${serviceType} booking.`);
    } else {
        // Với chuyến theo km, giữ logic tìm tài xế GẦN
        const MAX_DISTANCE_KM = 20; // Bán kính 20km
        for (const [driverId, info] of onlineDrivers.entries()) {
          console.log("pickupLocation", pickupLocation);
            const distance = calculateDistance(
                pickupLocation.lat,
                pickupLocation.lng,
                info.location.lat,
                info.location.lng
            );
           
            if (distance <= MAX_DISTANCE_KM && info.socketId) {
              const activeBooking = await Booking.findOne({
                driverId,
                status: { $in: ["Pending", "Confirmed", "Arriving", "Ongoing"] },
              });
            
              if (activeBooking) {
                console.log(` Driver ${driverId} is busy with booking ${activeBooking._id}`);
                continue; // bỏ qua tài xế này
              }
            
                console.log(` Driver ${driverId} is nearby (${distance.toFixed(2)} km)`);
                nearbyDrivers.push({ driverId, socketId: info.socketId });
            }
        }
        console.log(`Found ${nearbyDrivers.length} nearby drivers.`);
    }
      // for (const [driverId, info] of onlineDrivers.entries()) {
      //   const distance = calculateDistance(
      //     pickupLocation.lat,
      //     pickupLocation.lng,
      //     info.location.lat,
      //     info.location.lng
      //   );
      //   if (distance <= 20) {
      //     // Bán kính 3km
      //     console.log(` Driver ${driverId} is nearby (${distance.toFixed(2)} km)`);
      //     nearbyDrivers.push({ driverId, socketId: info.socketId });
      //   }
      // }

      if (nearbyDrivers.length === 0) {
        console.log("No nearby drivers found for", customerId);
        io.to(customerSocketId).emit("noDriverAvailable", {
          message: "Không có tài xế nào gần bạn vào lúc này.",
        });

        // gửi notification realtime + lưu DB (nếu muốn lưu cho customer) - dùng sendNotification
        try {
          await sendNotification(io, {
            userId: customerId,
            title: "Không tìm thấy tài xế",
            message: "Xin lỗi, hiện chưa có tài xế khả dụng gần bạn. Vui lòng thử lại sau.",
            type: "warning",
            meta: { pickupLocation, serviceType },
            // email: customerInfo.email, sendMail: false // nếu muốn gửi email bật lên
          });
        } catch (err) {
          console.error("Failed to send 'no driver' notification:", err?.message || err);
        }
        return;
      }

      //Tạo mã yêu cầu duy nhất
      const requestId = crypto.randomUUID();
      console.log(`Created booking request ID: ${requestId}`);
      // Lưu vào pendingRequests
      pendingRequests.set(requestId, {
        queue: nearbyDrivers,
        currentIndex: 0,
        data,
        customerSocketId,
        customerInfo, // Thêm thông tin khách hàng
      });

      // Gửi yêu cầu đến tài xế đầu tiên
      const firstDriver = nearbyDrivers[0];
      io.to(firstDriver.socketId).emit("newBookingRequest", {
        requestId,
        pickupLocation,
        dropoffLocation,
        estimatedFare: finalFare,
        customerId: customerId,
        serviceType: serviceType,
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        startTime: startTime,
        endTime: endTime,
        price: finalFare,
        customerInfo: {
          id: customerInfo._id,
          fullName: customerInfo.fullName,
          phone: customerInfo.phone,
          avatar: customerInfo.avatar,
        },
      });
      if (firstDriver.driverId) {
        await sendNotification(io, {
          userId: firstDriver.driverId || null,
          title: `Bạn có cuốc xe mới`,
          message: `Thông tin chuyến đi:- Loại dịch vụ: ${serviceType}
          - Điểm đón: ${JSON.stringify(pickupLocation?.address)}
          - Điểm đến: ${JSON.stringify(dropoffLocation?.address)}
          - Giá: ${formatCurrency(finalFare)}`,
          type: "booking",
          meta: {requestId},
        });
      }

      // Set timeout (15s) nếu tài xế không phản hồi
      const timerId = setTimeout(() => {
        nextDriver(io, requestId);
      }, 15000);

      const reqObj = pendingRequests.get(requestId);
      reqObj.timerId = timerId;
      pendingRequests.set(requestId, reqObj);

      console.log(`Sent booking request ${requestId} to driver ${firstDriver.driverId}`);
    });

    // Khi tài xế chấp nhận cuốc
    socket.on("driverAccept", async ({ requestId, driverId }) => {
      const reqObj = pendingRequests.get(requestId);
      if (!reqObj) return;

      const current = reqObj.queue[reqObj.currentIndex];
      if (!current || current.driverId !== driverId) return;

      // Dọn timer và xác nhận
      clearTimeout(reqObj.timerId);
      if (!pendingRequests.has(requestId)) return; // tránh double accept

      io.to(reqObj.customerSocketId).emit("bookingConfirmed", {
        driverId,
        pickupLocation: reqObj.data.pickupLocation,
        dropoffLocation: reqObj.data.dropoffLocation,
        price: reqObj.data.finalFare,
        requestId: requestId,
      });

      try {
        await sendNotification(io, {
          userId: reqObj.data.customerId,
          title: "Tài xế đã nhận chuyến",
          message: `Đã có tài xế nhận chuyến của bạn. Vui lòng chờ tài xế đến điểm đón.`,
          type: "booking",
          meta: { requestId, driverId },
          // email: reqObj.customerInfo?.email, sendMail: false
        });
        console.log("sendNotification bookingConfirmed to customer", reqObj.data.customerId);
      } catch (err) {
        console.error("Failed to send bookingConfirmed notification:", err?.message || err);
      }

      reqObj.waitingForBookingId = true;
  pendingRequests.set(requestId, reqObj);
  console.log(`Driver ${driverId} accepted booking ${requestId}, waiting for bookingId from renter`);
    

      // io.to(current.socketId).emit("bookingYouAccepted", { success: true });
      // pendingRequests.delete(requestId);

      // console.log(`Driver ${driverId} accepted booking ${requestId}`);
    });

    //thay đổi status booking
    socket.on("updateBookingStatus", async ({ bookingId, status }) => {
        try {
             console.log(`Updating booking status: ${bookingId} to ${status}`);
             const booking = await Booking.findById(bookingId)
             .populate("customerId")
             .populate("driverId");

             if (!booking) {
                console.log("Booking not found");
              return;
            }
            booking.status = status;
            await booking.save();

            io.emit("bookingStatusUpdated", {
                bookingId,
                updates: { status },
                customerId: booking.customerId._id?.toString() || null,
                driverId: booking.driverId._id?.toString() || null,
                timestamp: new Date().toISOString()
            });
            console.log("booking status update", status);
            console.log("booking.customerId._id", booking.customerId._id?.toString());
            console.log("booking.driverId._id", booking.driverId._id?.toString());
            console.log(`Broadcasted status update for booking ${bookingId}`);
            // if (customerId) {
              let title = "Cập nhật chuyến đi";
              let message = `Trạng thái chuyến đi đã đổi: ${status}`;
              console.log("message", message);
              if (status === "Completed") {
                title = "Chuyến đi đã hoàn tất";
                message = "Cảm ơn bạn đã sử dụng SmartDrive. Hãy đánh giá tài xế nhé!";
              } else if (status === "Ongoing") {
                title = "Chuyến đi bắt đầu";
                message = "Tài xế đã bắt đầu hành trình.";
              } else if (status === "Arriving") {
                title = "Tài xế đang đến";
                message = "Tài xế đang tới điểm đón của bạn.";
              } else if (status === "Cancelled") {
                title = "Chuyến đi bị hủy";
                message = "Chuyến đi đã bị hủy.";
              }
    
            await sendNotification(io, {
              userId: booking.customerId?._id?.toString() || null,
              title,
              message,
              type: "booking",
              meta: { bookingId, status },
              // sendMail: false
            });
            // }
            // if (booking.driverId?._id) {
            //   await sendNotification(io, {
            //     userId: booking.driverId?._id?.toString() || null,
            //     title: `Cập nhật chuyến ${bookingId}`,
            //     message: `Trạng thái chuyến đi: ${status}`,
            //     type: "booking",
            //     meta: { bookingId, status },
            //   });
            // }
            
            // Thông báo chat kết thúc nếu booking Completed hoặc Cancelled
            if (status === "Completed" || status === "Cancelled") {
              const roomName = `booking:${bookingId}`;
              io.to(roomName).emit("chatEnded", {
                bookingId,
                status,
                message: status === "Completed" 
                  ? "Chuyến đi đã hoàn tất. Phiên chat đã kết thúc." 
                  : "Chuyến đi đã bị hủy. Phiên chat đã kết thúc.",
              });
              console.log(`Chat ended for booking ${bookingId} - Status: ${status}`);
            }
    
        } catch (error) {
            console.error("Error updating booking status:", error);
        }
    });

    // Khi tài xế từ chối
    socket.on("driverDecline", ({ requestId, driverId }) => {
      const reqObj = pendingRequests.get(requestId);
      if (!reqObj) return;

      const current = reqObj.queue[reqObj.currentIndex];
      if (!current || current.driverId !== driverId) return;

      clearTimeout(reqObj.timerId);
      console.log(`Driver ${driverId} declined booking ${requestId}`);
      io.to(reqObj.customerSocketId).emit("notification", {
        type: "info",
        title: "Tài xế từ chối chuyến đi",
        message: "Tài xế hiện tại không thể nhận chuyến, hệ thống đang tìm tài xế khác...",
      });
      nextDriver(io, requestId);
    });

    socket.on("driverLocationUpdate", async ({ driverId, lat, lng }) => {
      if (!driverId) return;
      await updateDriverLocation(driverId, lat, lng);
    
      // cache latest location
      const existing = await redis.get(`driver:${driverId}`);
      const info = existing ? JSON.parse(existing) : {};
      info.location = { lat, lng };
      info.lastSeen = Date.now();
      await redis.set(`driver:${driverId}`, JSON.stringify(info));
    
      if (onlineDrivers.has(driverId)) {
        onlineDrivers.get(driverId).location = { lat, lng };
      }
    
      // find active request/booking to forward to customer
      // if you have bookingId mapping, emit globally so clients filter by driverId:
      io.emit("driverLocationUpdate", { driverId, location: { lat, lng } });
    });

         // khi client (khách hoặc tài xế) báo hủy cuốc
        socket.on("bookingCancelled", async ({ bookingId, reason }) => {
            console.log("bookingCancelled:", bookingId, reason);
        // Phát thông báo hủy cuốc cho tất cả client (hoặc target theo bookingId nếu có mapping)
        io.emit("bookingCancelled", { bookingId, reason, timestamp: new Date().toISOString() });

        // Đồng bộ trạng thái để tất cả màn hình update UI
        io.emit("bookingStatusUpdated", {
        bookingId,
        updates: { status: "Cancelled" },
        timestamp: new Date().toISOString(),
      });
      try {
        if (customerId) {
          await sendNotification(io, {
            userId: customerId,
            title: "Chuyến đi bị hủy",
            message: reason ? `Lý do: ${reason}` : "Chuyến đi của bạn đã bị hủy.",
            type: "warning",
            meta: { bookingId, reason },
          });
        }
        if (driverId) {
          await sendNotification(io, {
            userId: driverId,
            title: "Khách hàng hủy chuyến",
            message: reason ? `Lý do: ${reason}` : "Khách hàng đã hủy chuyến.",
            type: "warning",
            meta: { bookingId, reason },
          });
        }
      } catch (err) {
        console.error("Failed to send bookingCancelled notifications:", err?.message || err);
      }
});

// Trong file socket BE, thêm vào io.on("connection", (socket) => { ... })
socket.on("joinCustomerRoom", ({ customerId }) => {
  if (customerId) {
    socket.join(customerId);
    console.log(`Customer ${customerId} joined room`);
  }
});

    /**
     * Join vào room user để nhận tin nhắn và thông báo
     */
    socket.on("joinUserRoom", ({ userId }) => {
      if (userId) {
        socket.userId = userId;
        const userRoom = `user:${userId}`;
        socket.join(userRoom);
        console.log(`User ${userId} joined user room ${userRoom}`);
        socket.emit("userRoomJoined", { userId });
      }
    });

    // ========== CHAT HANDLERS ==========
    
    /**
     * Join vào room chat của một booking
     */
    socket.on("joinChatRoom", async ({ bookingId, userId }) => {
      try {
        // Lưu userId vào socket
        socket.userId = userId;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
          socket.emit("chatError", { message: "Không tìm thấy booking" });
          return;
        }

        // Kiểm tra user có phải là customer hoặc driver không
        const isCustomer = booking.customerId.toString() === userId.toString();
        const isDriver = booking.driverId.toString() === userId.toString();

        if (!isCustomer && !isDriver) {
          socket.emit("chatError", { message: "Không có quyền truy cập chat này" });
          return;
        }

        // Kiểm tra trạng thái booking
        const allowedStatuses = ["Confirmed", "Arriving", "Ongoing"];
        if (!allowedStatuses.includes(booking.status)) {
          socket.emit("chatError", { 
            message: `Không thể chat. Booking đang ở trạng thái "${booking.status}"` 
          });
          return;
        }

        // Join vào room booking
        const roomName = `booking:${bookingId}`;
        socket.join(roomName);
        
        // Đồng thời join vào room user để nhận tin nhắn ngay cả khi chưa mở chat
        const userRoom = `user:${userId}`;
        socket.join(userRoom);
        
        console.log(`User ${userId} joined chat room for booking ${bookingId} and user room ${userRoom}`);
        
        // Xác nhận đã join thành công
        socket.emit("chatRoomJoined", { bookingId, userId });
      } catch (error) {
        console.error("Error joining chat room:", error);
        socket.emit("chatError", { message: "Có lỗi xảy ra khi tham gia chat" });
      }
    });

    /**
     * Gửi tin nhắn real-time
     */
    socket.on("sendChatMessage", async ({ bookingId, senderId, message }) => {
      try {
        if (!message || !message.trim()) {
          socket.emit("chatError", { message: "Tin nhắn không được để trống" });
          return;
        }

        // Lấy thông tin booking để xác định receiver
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          socket.emit("chatError", { message: "Không tìm thấy booking" });
          return;
        }

        // Xác định receiver
        const receiverId = booking.customerId.toString() === senderId.toString()
          ? booking.driverId.toString()
          : booking.customerId.toString();

        // Gửi tin nhắn qua service (có validation)
        const chatMessage = await sendMessageService(bookingId, senderId, message.trim());
        
        // Populate sender info
        await chatMessage.populate("senderId", "fullName avatar role");

        // Đảm bảo sender đã join room
        const roomName = `booking:${bookingId}`;
        socket.join(roomName);

        // Chuẩn bị data tin nhắn
        const messageData = {
          message: chatMessage,
          bookingId: bookingId,
        };

        // Lấy số sockets trong room để debug
        const bookingRoomSockets = await io.in(roomName).fetchSockets();
        const receiverRoomSockets = await io.in(`user:${receiverId}`).fetchSockets();

        // Emit đến room booking (cho cả 2 bên nếu đã join)
        io.to(roomName).emit("newChatMessage", messageData);

        // Emit đến room user của receiver để đảm bảo họ nhận được ngay cả khi chưa join booking room
        io.to(`user:${receiverId}`).emit("newChatMessage", messageData);

        console.log(`Chat message sent in booking ${bookingId} by user ${senderId} to receiver ${receiverId}`);
        console.log(`Emitted to room: ${roomName} (${bookingRoomSockets.length} sockets) and user:${receiverId} (${receiverRoomSockets.length} sockets)`);
      } catch (error) {
        console.error("Error sending chat message:", error);
        socket.emit("chatError", { 
          message: error.message || "Có lỗi xảy ra khi gửi tin nhắn" 
        });
      }
    });

    /**
     * Đánh dấu tin nhắn đã đọc
     */
    socket.on("markChatAsRead", async ({ bookingId, userId }) => {
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          socket.emit("chatError", { message: "Không tìm thấy booking" });
          return;
        }

        // Kiểm tra quyền
        const isCustomer = booking.customerId.toString() === userId.toString();
        const isDriver = booking.driverId.toString() === userId.toString();

        if (!isCustomer && !isDriver) {
          socket.emit("chatError", { message: "Không có quyền truy cập chat này" });
          return;
        }

        // Đánh dấu đã đọc
        await ChatMessage.updateMany(
          {
            bookingId,
            receiverId: userId,
            isRead: false,
          },
          {
            isRead: true,
            readAt: new Date(),
          }
        );

        // Thông báo cho room
        const roomName = `booking:${bookingId}`;
        io.to(roomName).emit("chatMarkedAsRead", {
          bookingId,
          userId,
        });
      } catch (error) {
        console.error("Error marking chat as read:", error);
        socket.emit("chatError", { message: "Có lỗi xảy ra khi đánh dấu đã đọc" });
      }
    });

    // ========== END CHAT HANDLERS ==========

    // Ngắt kết nối
    socket.on("disconnect", async() => {
      for (const [driverId, info] of onlineDrivers.entries()) {
        if (info.socketId === socket.id) {
          onlineDrivers.delete(driverId);
          await redis.del(`driver:${driverId}`);
          console.log(`Driver ${driverId} disconnected`);
          break;
        }
      }
    });
  });
}


// Chuyển sang tài xế kế tiếp nếu tài xế hiện tại không phản hồi hoặc từ chối
function nextDriver(io, requestId) {
  const reqObj = pendingRequests.get(requestId);
  if (!reqObj) return;

  reqObj.currentIndex += 1;
  if (reqObj.currentIndex >= reqObj.queue.length) {
    io.to(reqObj.customerSocketId).emit("noDriverAvailable", {
      message: "Không tìm thấy tài xế khả dụng.",
    });
    sendNotification(io, {
      userId: reqObj.data.customerId,
      title: "Không tìm thấy tài xế",
      message: "Rất tiếc, không có tài xế phù hợp. Vui lòng thử lại sau.",
      type: "warning",
      meta: { requestId },
    }).catch((e) => console.error("sendNotification error:", e));
    if (reqObj.timerId) clearTimeout(reqObj.timerId);
    pendingRequests.delete(requestId);
    return;
  }

  const candidate = reqObj.queue[reqObj.currentIndex];
  io.to(candidate.socketId).emit("newBookingRequest", {
    requestId,
    pickupLocation: reqObj.data.pickupLocation,
    dropoffLocation: reqObj.data.dropoffLocation,
    estimatedFare: reqObj.data.finalFare,
    customerId: reqObj.data.customerId,
    serviceType: reqObj.data.serviceType,
    startTime: reqObj.data.startTime,
    endTime: reqObj.data.endTime,
    price: reqObj.data.finalFare,
    paymentMethod: reqObj.data.paymentMethod,
    paymentStatus: reqObj.data.paymentStatus,
    customerInfo: reqObj.customerInfo ? {
      id: reqObj.customerInfo._id,
      fullName: reqObj.customerInfo.fullName,
      phone: reqObj.customerInfo.phone,
      avatar: reqObj.customerInfo.avatar,
    } : null,
  });

  const timerId = setTimeout(() => {
    nextDriver(io, requestId);
  }, 15000);

  reqObj.timerId = timerId;
  pendingRequests.set(requestId, reqObj);
  console.log(`Sent to next driver ${candidate.driverId}`);
}


//  Hàm tính khoảng cách giữa hai toạ độ (theo km)

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { onlineDrivers, pendingRequests };
