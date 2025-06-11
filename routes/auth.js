var express = require('express');
var router = express.Router();
const memberModel = require('../model/member');
const bcrypt = require("bcrypt");

router.get('/', function(req, res, next) {
    res.render('guest', { title: 'UI UX 課程' });
});

router.get('/register', function(req, res, next) {
    res.render('register', { title: 'UI UX 課程' });
});

router.post("/register", async function(req, res, next) {
    // Whether field not empty
    const {name, pw, email, isTeacher, tCode, studentID} = req.body;
    if(!name || !email || !pw) {
      console.log("No data", name, email, pw);
      return res.redirect("/auth/register?msg=姓名、email、密碼皆需輸入！🙏🏻");
    }
    // Whether account already exist
    let member = await memberModel.findOne({email});
    if(member) {
      console.log("Email has been registered");
      return res.redirect("/auth/register?msg=Email 已註冊過！😱");
    }
    let isT = false;
    if(isTeacher) {
        // Teacher register code
        if(tCode!=process.env.teacherRegisterCode) {
            console.log("tCode not correct");
            isT = false;
            return res.redirect("/auth/register?msg=教師代碼輸入錯誤！🙅"); 
        } else {
            isT = true;
        }
    } else if(!studentID) {
        return res.redirect("/auth/register?msg=學生註冊請輸入學號！🫶🏻"); 
    }
    // Create account
    const hashPW = await bcrypt.hash(pw, 10); // Hash the pw
    member = new memberModel({name, email, pw: hashPW, isTeacher: isT, studentID});
    await member.save();
    res.redirect("/auth/login/?msg=註冊成功，請登入開始使用😊");
});

router.get('/login', function(req, res, next) {
    res.render('login', { title: 'UI UX 課程' });
});

router.post("/login", async function(req, res, next) {
    const {email, pw} = req.body;
      
    // 確認是否有已使用者資料
    if(!email || !pw){
        console.log("No data", email, pw);
        return res.redirect("login");
    }

    // 查詢是否有此使用者
    let member = await memberModel.findOne({email});
    if(!member){
        console.log("Member doesn't exits.");
        return res.redirect("login");
    }
  
    // 密碼正確檢查

    // 解雜湊
    bcrypt.compare(pw, member.pw, function(err, result) {
        if(err){
            console.log(err)
            return res.status(404).json({
                status:404,
                reason:''
            })
        } 
        if (!result) {
            console.log("Password doesn't match");
            return res.redirect("login");
        }
        req.session.isAuth = true;
        req.session.name = member.name;
        req.session.email = member.email;
        req.session.isTeacher = member.isTeacher;
        if(member.isTeacher){res.redirect("/t");}
        else {res.redirect("/");}
    });
});

router.get("/logout", function(req, res, next) {
    if(req.session){
      console.log(req.session);
      req.session.destroy((err) =>{
          if(err) throw err;
          console.log("Member has logged out");
          // res.clearCookie("")
          return res.redirect("/auth");
      });
    }
});

module.exports = router;