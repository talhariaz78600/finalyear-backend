const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const userModel = require('../models/users/User');

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_REDIRECT_URI,
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const { linking, role } = JSON.parse(req.query.state || '{}');

          const existingUser = await userModel.findOne({
            email: profile.emails[0].value
          });

          // already present user must has the google provider in order for him to login
          if (existingUser) {
            console.log('existingUser', existingUser.fullName);
            if (linking) {
              // If linking, add Google to providers if not already linked
              if (!existingUser.providers.includes('google')) {
                existingUser.providers.push('google');
                existingUser.googleId = profile.id;
                existingUser.emailVerified = true;
                await existingUser.save();
              }
              return done(null, existingUser);
            }
            if (!existingUser.providers.includes('google')) {
              return done(
                'This email has no Google account linked. Try to link it from profile',
                null
              );
            }
            // set the googleId, emailVerified and save the user if not already done
            let needsUpdate = false;

            if (!existingUser.googleId) {
              existingUser.googleId = profile.id;
              needsUpdate = true;
            }

            if (!existingUser.emailVerified) {
              existingUser.emailVerified = true;
              needsUpdate = true;
            }

            if (needsUpdate) {
              await existingUser.save();
            }
            return done(null, existingUser);
          }
          if (!["vendor", "customer"].includes(role)) {
            return done('Invalid role, please sign up with a valid role', null);
          }
          const newUser = await userModel.create({
            googleId: profile.id,
            firstName: profile?.name?.givenName || 'Unkown',
            lastName: profile?.name?.familyName || 'Unkown',
            role,
            email: profile.emails[0].value,
            emailVerified: true,
            profilePicture: profile?._json?.picture,
            providers: ['google']
          });
          await newUser.save();
          return done(null, newUser);
        } catch (error) {
          console.log('error', error);
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    console.log('inside serializeUser', user.firstName);
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    console.log('inside deserializeUser', id);
    try {
      const user = await userModel.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
