const express = require('express');
const passport = require('passport');
const requireAuth = require('../middlewares/requireAuth');
const {
  registerUser,
  loginUser,
  verifyotp,
  verifyPhoneotp,
  sendEmailVerification,
  sendPhoneVerification,
  forgotPassword,
  resetPassword,
  createFirstPassword,

  verifyForgetOtp,
  resendOtp,
  resendOtpNumber,
  // buySubscription,
  updatePassword
} = require('../controllers/authController');
const userModel = require('../models/users/User');
const logActionMiddleware = require('../middlewares/logActionMiddleware');

// const checkSubscriptionValidity = require('../middlewares/checkSubscriptionValidity');

const router = express.Router();

router.post('/register', logActionMiddleware('Register', 'User'), registerUser);
// router.post("/login", checkSubscriptionValidity, loginUser);
router.post('/login', logActionMiddleware('Login', 'User'), loginUser);
router.patch('/updateUserPassword', requireAuth, logActionMiddleware('update password', 'User'), updatePassword);




router.get('/dashboard', async (req, res) => {
  console.log('Checking user authentication', req.user);

  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const user = await userModel.findById(req.user.id);
  return res.json({
    success: true,
    message: 'Welcome to the dashboard',
    user
  });
});

router.get('/logout', (req, res, next) => {
  console.log('inside logout route');
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
    return 0;
  });
});



router.post('/send-otp-email', logActionMiddleware('Send OTP Email', 'User'), sendEmailVerification);
router.post('/verifyotp', logActionMiddleware('Verify OTP', 'User'), verifyotp);
router.post('/resend-otp-email', logActionMiddleware('Resend OTP Email', 'User'), resendOtp);

router.post('/send-otp-number', logActionMiddleware('Resend OTP Number', 'User'), sendPhoneVerification);
router.post('/verifyPhoneotp', logActionMiddleware('Verify Phone OTP', 'User'), verifyPhoneotp);
router.post('/resend-otp-number', logActionMiddleware('Resend OTP Number', 'User'), resendOtpNumber);

router.post('/forgotPassword', logActionMiddleware('Forgot Password', 'User'), forgotPassword);
router.patch('/resetPassword', logActionMiddleware('Reset Password', 'User'), resetPassword);

// route to set a password for the account, when no password is there. (maybe user signed up using socials)
router.patch('/createfirstPassword', requireAuth, logActionMiddleware("Create First Password", 'User'), createFirstPassword);


// router.post('/Subscription', requireAuth, buySubscription);
router.post('/forgetOTP', logActionMiddleware('Verify Forget OTP', 'User'), verifyForgetOtp);

module.exports = router;
