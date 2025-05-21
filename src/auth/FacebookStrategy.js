const FacebookStrategy = require('passport-facebook').Strategy;
require('dotenv').config();
const userModel = require('../models/users/User');

module.exports = function (passport) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FB_CLIENT_ID,
        clientSecret: process.env.FB_CLIENT_SECRET,
        callbackURL: process.env.FB_REDIRECT_URI,
        profileFields: ["id", "displayName", "email", "photos"],
        enableProof: true,
        // eslint-disable-next-line comma-dangle
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
 
        try {
            console.log("new Profile", profile);
          const { linking, role } = JSON.parse(req.query.state || '{}');
          const existingUser = await userModel.findOne({
            email: profile.emails[0].value
          });

          if (existingUser) {
            // console.log('existingUser', existingUser.fullName);
            if (linking) {
              // If linking, add Google to providers if not already linked
              if (!existingUser.providers.includes('facebook')) {
                existingUser.providers.push('facebook');
                existingUser.facebookId = profile.id;
                existingUser.emailVerified = true;
                await existingUser.save();
              }
              return done(null, existingUser);
            }
            if (!existingUser.providers.includes('facebook')) {
              return done(
               'This email has no Facebook account linked. Try to link it from profile',
                null
              );
            }
            // set the facebookID, emailVerified and save the user if not already done
            let needsUpdate = false;

            if (!existingUser.googleId) {
              existingUser.facebookId = profile.id;
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
          if(!["vendor","customer"].includes(role)){
            return done('Invalid role, please sign up with a valid role', null);
          }
          
        

          const newUser = await userModel.create({
            facebookId: profile.id,
            firstName: profile?.name?.givenName || 'Unkown',
            lastName: profile?.name?.familyName || 'Unkown',
            role,
            email: profile.emails[0].value,
            emailVerified: true,
            providers: ['facebook'],
            profilePicture: profile.photos[0].value || 'https://example.com/default-profile-pic.jpg'
          });
          await newUser.save();
          return done(null, newUser);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    // console.log('inside fb serializeUser', user.firstName);
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    // console.log('inside fb deserializeUser', id);
    try {
      const user = await userModel.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
