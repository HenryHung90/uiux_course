// 載入 dotenv，讀取 dotenv 的設定
require("dotenv").config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// 製作 Session
const session = require("express-session");
// 跟 MongoDB 連線用
const mongoose = require("mongoose");
// 將 Session 寫入資料庫用
const mongoStore = require("connect-mongo");

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var courseRouter = require('./routes/course');

var app = express();

// Mongoose mongoDB 連線
mongoose.set('strictQuery', true); // Only save data specified in Schema
mongoose.connect(process.env.mongodbUrl);
const db = mongoose.connection;
db.on('error', (error) => console.error("Connect error: ", error));
// Connect successfully
db.once('open', () => {console.log('DB connect successfully!')});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 使用 Session
app.use(session({
  secret: process.env.sessionSecret,
  resave: false, // 即使 session 無更動，還是強制儲存
  saveUninitialized: true, // 第一次連線是否儲存資料
  store: mongoStore.create({
    mongoUrl: process.env.mongodbUrl, // DB location
    collection: "session", // collection name
    ttl: 60*24, // Default: 14 Days
  }),
}))

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/course', courseRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
