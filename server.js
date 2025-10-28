import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./src/config/db.js";
import { getSwaggerSpec, swaggerUi } from "./src/config/swagger.js";
import http from "http";
import { Server } from "socket.io";
import { setupSocket } from "./src/sockets/socketHandler.js";
import { initSocket } from "./src/socket.js";

const PORT = process.env.PORT || 5000;

connectDB();

//Swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(getSwaggerSpec()));

// Tạo HTTP server để chia sẻ cho Express và Socket.IO
const server = http.createServer(app);

// Tạo Socket.IO instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Gọi hàm setup socket
setupSocket(io);
initSocket(io);

// Lưu lại server và io để có thể import ở nơi khác
export { io, server };

// app.listen(PORT, () => {
//   console.log(`Server is running on PORT ${PORT}`);
//   console.log(`API docs available at http://localhost:${PORT}/api-docs`);
// });
server.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
  console.log(`API docs available at http://localhost:${PORT}/api-docs`);
  console.log(`Socket.IO is ready on ws://localhost:${PORT}`);
});
