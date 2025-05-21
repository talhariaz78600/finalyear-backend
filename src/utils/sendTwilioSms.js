const twilio = require('twilio');
require('dotenv').config();
const AppError = require('./appError');

const sendTwilioSms = async (to, text) => {
  try {
    if (
      !process.env.TWILLIO_ACCOUNT_ID ||
      !process.env.TWILLIO_AUTH_TOKEN ||
      !process.env.TWILLIO_PHONE_NUMBER
    ) {
      throw new AppError('Missing Twilio environment variables.', 500);
    }

    if (!to || !text) {
      throw new AppError('Recipient phone number and message text are required.', 400);
    }

    const client = twilio(process.env.TWILLIO_ACCOUNT_ID, process.env.TWILLIO_AUTH_TOKEN);

    const smsResponse = await client.messages.create({
      body: text,
      from: process.env.TWILLIO_PHONE_NUMBER,
      to
    });

    return smsResponse;
  } catch (error) {
    
    const errorMessage = error.message || 'An unknown error occurred while sending SMS.';
    console.error('Twilio SMS Error:', errorMessage);
    return null; // or throw an error if you want to handle it upstream
    // throw new AppError(`Failed to send SMS: ${errorMessage}`, error.statusCode || 500);
  }
};


const sendOtpVoiceCall = async (phoneNumber, otpCode) => {
  try {
    if (
      !process.env.TWILLIO_ACCOUNT_ID ||
      !process.env.TWILLIO_AUTH_TOKEN ||
      !process.env.TWILLIO_PHONE_NUMBER
    ) {
      throw new AppError('Twilio environment variables missing.', 500);
    }

    if (!phoneNumber || !otpCode) {
      throw new AppError('Phone number and OTP are required.', 400);
    }

    const client = twilio(process.env.TWILLIO_ACCOUNT_ID, process.env.TWILLIO_AUTH_TOKEN);

    // Format OTP as spaced digits so it's read clearly
    const formattedOtp = otpCode.split('').join(' ');

    const twimlMessage = `<Response><Say voice="alice" language="en-US">Hello! Your verification code is ${formattedOtp}. Thank you!</Say></Response>`;

    const call = await client.calls.create({
      twiml: twimlMessage,
      to: phoneNumber,
      from: process.env.TWILLIO_PHONE_NUMBER,
    });

    return call;
  } catch (error) {
    console.error('Voice Call Error:', error.message);
    throw new AppError(`Voice call failed: ${error.message}`, error.statusCode || 500);
    return null;
  }
};

module.exports ={sendTwilioSms,sendOtpVoiceCall};



