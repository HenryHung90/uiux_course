var express = require('express');
var router = express.Router();

// 登入確認 middleware
const isAuth = (req, res, next) =>{
  if(!req.session.isAuth) {
      console.log("Doesn't have the permission");
      return res.redirect("/auth/");
  }
  next();
}
const isTeacher = (req, res, next) =>{
  if(!req.session.isTeacher) {
      console.log("Doesn't have the permission");
      return res.redirect("/auth/");
  }
  next();
}

/* GET home page. */
router.get('/', isAuth, function(req, res, next) {
  res.render('member', {title: "Welcome Back, "+req.session.name});
});

router.get('/t', isAuth, isTeacher, function(req, res, next) {
  res.render('member_t', {title: req.session.name+" 老師"});
});

module.exports = router;
