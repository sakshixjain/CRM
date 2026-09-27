const createTransporter = require('../config/emailConfig');
const {
  welcomeEmailTemplate,
  passwordResetTemplate,
  verificationEmailTemplate,
} = require('../utils/emailTemplates');

// Send Welcome Email
const sendWelcomeEmail = async (req, res) => {
  try {
    const { email, name } = req.body;

    const transporter = createTransporter();

    const mailOptions = {
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Welcome to Our Platform!',
      html: welcomeEmailTemplate(name),
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Welcome email sent successfully',
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message,
    });
  }
};

// Send Password Reset Email
const sendPasswordResetEmail = async (req, res) => {
  try {
    const { email, resetLink } = req.body;

    const transporter = createTransporter();

    const mailOptions = {
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Password Reset Request',
      html: passwordResetTemplate(resetLink),
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully',
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message,
    });
  }
};

// Send Verification Email
const sendVerificationEmail = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    const transporter = createTransporter();

    const mailOptions = {
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Email Verification Code',
      html: verificationEmailTemplate(verificationCode),
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message,
    });
  }
};

// Generic email sender
const sendEmail = async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;

    const transporter = createTransporter();

    const mailOptions = {
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      html: html || undefined,
      text: text || undefined,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message,
    });
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendEmail,
};