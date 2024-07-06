const mongoose = require("mongoose"); // For connecting DB

const lessonSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    files: [{
        name: String,
        path: String,
        contentType: String
    }],
    description: {
        type: String
    },
    semester: {
        type: String,
        required: true
    }
});

const Lesson = mongoose.model("lessons"/* 資料表 */, lessonSchema);

module.exports = Lesson;