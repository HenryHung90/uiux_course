const mongoose = require("mongoose"); // For connecting DB

const semesterSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    id: {
        type: String,
        required: true
    }
});

const Semester = mongoose.model("semester"/* 資料表 */, semesterSchema);

module.exports = Semester;