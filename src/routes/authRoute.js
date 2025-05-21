const express = require('express');
const passport = require('passport');
const requireAuth = require('../middlewares/requireAuth');
const {
  registerUser,
  loginUser,
  googleCallback,
  facebookCallback,
  verifyotp,
  verifyPhoneotp,
  sendEmailVerification,
  sendPhoneVerification,
  forgotPassword,
  resetPassword,
  createFirstPassword,
  delinkGoogle,
  delinkFacebook,
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

// SOCIAL LOGIN ROUTES (GOOGLE)
router.get('/login/withGoogle', (req, res, next) => {
  const linking = req.query.linking === 'true';
  const role = req.query.role || 'invalid';
  console.log(role, 'role from query params');
  console.log(linking, 'linking from query params');
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: JSON.stringify({ linking, role })
  })(req, res, next);
});


router.get(
  '/login/google/callback',
  (req, res, next) => {
    passport.authenticate('google', async (err, user, info) => {
      console.log('inside google callback', err, user, info);
      if (err || !user) {
        const error = encodeURIComponent(err?.toString() || 'Authentication failed.');
        return res.redirect(`${process.env.FRONTEND_URL}/login-error?error=${error}`);
      }
      req.login(user, async (loginErr) => {
        if (loginErr) {
          const error = encodeURIComponent(loginErr.toString());
          return res.redirect(`${process.env.FRONTEND_URL}/login-error?error=${error}`);
        }
        next(); // go to googleCallback
      });
    })(req, res, next);
  },
  googleCallback
);



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

// SOCIAL LOGIN ROUTES (FACEBOOK)
router.get('/login/withFacebook', (req, res, next) => {
  const linking = req.query.linking === 'true';
  const role = req.query.role || 'user'; // default role to 'user' if not provided

  // JSON stringify state only if needed
  const state = JSON.stringify({ linking, role });

  passport.authenticate('facebook', {
    scope: ['email'],
    state // Facebook accepts `state` as a query string param
  })(req, res, next);
});


router.get(
  '/login/facebook/callback',
 (req, res, next) => {
    passport.authenticate('facebook', async (err, user, info) => {
      console.log('inside google callback', err, user, info);
      if (err || !user) {
        const error = encodeURIComponent(err?.toString() || 'Authentication failed.');
        return res.redirect(`${process.env.FRONTEND_URL}/login-error?error=${error}`);
      }
      req.login(user, async (loginErr) => {
        if (loginErr) {
          const error = encodeURIComponent(loginErr.toString());
          return res.redirect(`${process.env.FRONTEND_URL}/login-error?error=${error}`);
        }
        next(); // go to googleCallback
      });
    })(req, res, next);
  },
  facebookCallback
);

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

router.post('/delink/google', requireAuth, delinkGoogle);
router.post('/delink/facebook', requireAuth, delinkFacebook);

// router.post('/Subscription', requireAuth, buySubscription);
router.post('/forgetOTP', logActionMiddleware('Verify Forget OTP', 'User'), verifyForgetOtp);

module.exports = router;
