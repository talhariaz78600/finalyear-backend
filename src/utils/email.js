const nodemailer = require('nodemailer');
const ejs = require('ejs');
const { convert } = require('html-to-text');
const AppError = require('./appError');

module.exports = class Email {
  constructor(email, name, url) {
    this.to = email;
    this.firstName = name?.split(' ')[0];
    this.url = url;
    this.from = process.env.EMAIL_FROM_CONFIG;
  }

  static newTransport() {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD
      }
    });
  }

  async sendTextEmail(subject, text, data) {
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      text
    };
    console.log('mailOptions=', mailOptions);
    if (data?.attachment) {
      mailOptions.attachments = [data.attachment];
    }
    try {
      await Email.newTransport().sendMail(mailOptions);
      console.log('Email sent successfully to:', this.to);
    } catch (error) {
      console.error('Error occurred in sending mail:', error);
      const errorMessage = error.message || 'Unknown email sending error';
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        console.log('Retrying email sending...');
        try {
          await Email.newTransport().sendMail(mailOptions);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }
      // throw new AppError(`Failed to send email: ${errorMessage}`, 500);
    }
  }
  async sendHtmlEmail(subject, body, data) {
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html: body,
    };
    console.log('mailOptions=', mailOptions);
    if (data?.attachment) {
      mailOptions.attachments = [data.attachment];
    }
    try {
      await Email.newTransport().sendMail(mailOptions);
      console.log('Email sent successfully to:', this.to);
    } catch (error) {
      console.error('Error occurred in sending mail:', error);
      const errorMessage = error.message || 'Unknown email sending error';
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        console.log('Retrying email sending...');
        try {
          await Email.newTransport().sendMail(mailOptions);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }
      throw new AppError(`Failed to send email: ${errorMessage}`, 500);
    }
  }

  async send(template, subject, data) {
    const html = await ejs.renderFile(`${__dirname}/../views/email/${template}.ejs`, {
      firstName: this.firstName,
      url: this.url,
      subject,
      data
    });

    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: convert(html, { wordwrap: 130 })
    };
    if (data?.attachment) {
      mailOptions.attachments = [data.attachment];
    }
    try {
      // await this.newTransport().sendMail(mailOptions);
      await Email.newTransport().sendMail(mailOptions); // Changed this line

    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error(error?.message ||" Failed to Send Email")
    }
  }

  async sendWelcome() {
    await this.send("welcome", "Welcome to the Natours Family!", {});
  }

  async sendPasswordReset() {
    await this.send('passwordReset', 'Your password reset token (valid for only 10 minutes)');
  }
};

