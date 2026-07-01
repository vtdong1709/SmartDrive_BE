import crypto from "crypto";

const sortObjectByKey = (obj) => {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = obj[key];
    });
  return sorted;
};

export const getVNPayConfig = () => {
  const tmnCode = process.env.VNP_TMNCODE;
  const hashSecret = process.env.VNP_HASHSECRET;
  const vnpUrl =
    process.env.VNP_URL ||
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const returnUrl = process.env.VNP_RETURN_URL;

  if (!tmnCode || !hashSecret || !returnUrl) {
    throw Object.assign(
      new Error("Thiếu cấu hình VNPay (VNP_TMNCODE, VNP_HASHSECRET, VNP_RETURN_URL)"),
      { statusCode: 500 }
    );
  }

  return { tmnCode, hashSecret, vnpUrl, returnUrl };
};

export const signVNPayParams = (params, hashSecret) => {
  const sorted = sortObjectByKey(params);
  const signData = new URLSearchParams(sorted).toString();
  const hmac = crypto.createHmac("sha512", hashSecret);
  return hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
};

export const buildVNPayPaymentUrl = (baseUrl, params, hashSecret) => {
  const secureHash = signVNPayParams(params, hashSecret);
  const signedParams = {
    ...params,
    vnp_SecureHash: secureHash,
  };
  return `${baseUrl}?${new URLSearchParams(signedParams).toString()}`;
};
