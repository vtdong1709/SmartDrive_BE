import nodemailer from "nodemailer";

export const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  console.log("SMTP Config:", { host, port, user, pass: pass ? "***" : null });

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });
};
