const welcomeEmailTemplate = ({
  userName,
  email,
  password,
  role,
  loginUrl,
}) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          background-color: #f4f6f9;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .header {
          background-color: #0f172a;
          color: white;
          padding: 20px;
          text-align: center;
        }
        .content {
          padding: 25px;
          color: #333;
        }
        .credentials {
          background: #f1f5f9;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
        }
        .credentials p {
          margin: 6px 0;
          font-weight: bold;
        }
        .button {
          display: inline-block;
          padding: 12px 25px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 15px;
        }
        .footer {
          text-align: center;
          padding: 15px;
          font-size: 12px;
          color: #888;
          background: #f8fafc;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Welcome to CRM System</h2>
        </div>
        <div class="content">
          <h3>Hello ${userName},</h3>

          <p>Your account has been successfully created.</p>
          <p>You have been assigned the role: <strong>${role}</strong></p>

          <div class="credentials">
            <p>Email: ${email}</p>
            <p>Temporary Password: ${password}</p>
          </div>

          <p>
            For security reasons, please login and change your password immediately.
          </p>

          <div style="text-align:center; ">
            <a href="${loginUrl}" class="button" style="color:white;">Login to Dashboard</a>
          </div>

          <p style="margin-top:20px;">
            If you did not request this account, please contact administrator.
          </p>
        </div>

        <div class="footer">
          © ${new Date().getFullYear()} Your Company Name. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
};


const passwordResetTemplate = (resetLink) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ff6b6b; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 10px 20px; background-color: #ff6b6b; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
        </div>
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>You requested to reset your password. Click the button below to proceed:</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const loginOtpTemplate = (verificationCode) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .code { font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background-color: #e3f2fd; border-radius: 5px; letter-spacing: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        <div class="content">
          <h2>Verify Your Email</h2>
          <p>Please use the following verification code:</p>
          <div class="code">${verificationCode}</div>
          <p>This code will expire in 15 minutes.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  welcomeEmailTemplate,
  passwordResetTemplate,
  loginOtpTemplate,
};