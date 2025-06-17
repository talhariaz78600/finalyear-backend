const AppError = require('../utils/appError');

module.exports =
  (roles) =>
  (req, res, next) => {

    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    // if(req.user?.adminRole==="subAdmin"){
    //   const currentTab = req.headers['x-tab'];
    //   console.log("currentTab",currentTab)
    //   if (!currentTab) {
    //     return res.status(400).json({ message: 'Missing tab context' });
    //   }
    //   if (!req?.user?.templateId?.tabPermissions.includes(currentTab)) {
    //     return res.status(403).json({ message: `User does not have access to tab: ${currentTab}` });
    //   }
    // }

    return next();
  };

