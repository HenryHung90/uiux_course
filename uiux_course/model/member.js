const mongoose = require("mongoose"); // For connecting DB

const memberSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true // Primary key
    },
    pw: {
        type: String,
        required: true
    },
    isTeacher: {
        type: Boolean,
        required: true
    },
    currentSemester: {
        type: String
    },
    studentID: {
        type: String
    }
});

const memberModel = mongoose.model("member"/* 資料表 */, memberSchema);

module.exports = memberModel;