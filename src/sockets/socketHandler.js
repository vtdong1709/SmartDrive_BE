import crypto from "crypto";
import { updateDriverLocation } from "../services/driverApplicationService.js";
import redis from "../redis.js";

// Lưu trữ tạm thời (in-memory)
const onlineDrivers = new Map(); // driverId -> { socketId, location, lastSeen }
const pendingRequests = new Map(); // requestId -> { queue, currentIndex, timerId, data, customerSocketId }

export function setupSocket(io) {
  console.log("Socket.IO initialized");

  io.on("connection", (socket) => {
    console.log(`New socket connected: ${socket.id}`);

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
    });

    // Khi tài xế tắt online
    socket.on("driverOffline", async ({ driverId }) => {
      console.log(`Driver ${driverId} went offline`);
      await setMyAvailabilityService(driverId, false);
      onlineDrivers.delete(driverId);
      await redis.del(`driver:${driverId}`);
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
    
      const { customerId, pickupLocation, dropoffLocation, finalFare } = data;
      const customerSocketId = socket.id;
      console.log(`Checking ${onlineDrivers.size} online drivers...`);
      //Lọc danh sách tài xế gần điểm đón
      const nearbyDrivers = [];
      for (const [driverId, info] of onlineDrivers.entries()) {
        const distance = calculateDistance(
          pickupLocation.lat,
          pickupLocation.lng,
          info.location.lat,
          info.location.lng
        );
        if (distance <= 20) {
          // Bán kính 3km
          console.log(` Driver ${driverId} is nearby (${distance.toFixed(2)} km)`);
          nearbyDrivers.push({ driverId, socketId: info.socketId });
        }
      }

      if (nearbyDrivers.length === 0) {
        console.log("No nearby drivers found for", customerId);
        io.to(customerSocketId).emit("noDriverAvailable", {
          message: "Không có tài xế nào gần bạn vào lúc này.",
        });
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
      });

      // Gửi yêu cầu đến tài xế đầu tiên
      const firstDriver = nearbyDrivers[0];
      io.to(firstDriver.socketId).emit("newBookingRequest", {
        requestId,
        pickupLocation,
        dropoffLocation,
        estimatedFare: finalFare,
      });

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
    socket.on("driverAccept", ({ requestId, driverId }) => {
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
      });

      io.to(current.socketId).emit("bookingYouAccepted", { success: true });
      pendingRequests.delete(requestId);

      console.log(`Driver ${driverId} accepted booking ${requestId}`);
    });

    // Khi tài xế từ chối
    socket.on("driverDecline", ({ requestId, driverId }) => {
      const reqObj = pendingRequests.get(requestId);
      if (!reqObj) return;

      const current = reqObj.queue[reqObj.currentIndex];
      if (!current || current.driverId !== driverId) return;

      clearTimeout(reqObj.timerId);
      console.log(`Driver ${driverId} declined booking ${requestId}`);
      nextDriver(io, requestId);
    });

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
