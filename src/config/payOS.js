import { PayOS } from "@payos/node";
import dotenv from "dotenv";
dotenv.config();

export const getPayOS = () => {
  const { PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY } = process.env;

  if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
    throw new Error("Không xác thực được PayOS Key");
  }

  return new PayOS({
    clientId: PAYOS_CLIENT_ID,
    apiKey: PAYOS_API_KEY,
    checksumKey: PAYOS_CHECKSUM_KEY,
    environment: "sandbox",
    debug: true,
  });
};
