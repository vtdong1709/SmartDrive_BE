import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./src/config/db.js";
import { getSwaggerSpec, swaggerUi } from "./src/config/swagger.js";

const PORT = process.env.PORT || 5000;

connectDB();

//Swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(getSwaggerSpec()));

app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
  console.log(`API docs available at http://localhost:${PORT}/api-docs`);
});
