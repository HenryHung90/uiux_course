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
    links: [{
        url: String
    }],
    hws: [{
        name: String,
        description: String,
        files: [{
            name: String,
            path: String,
            contentType: String
        }],
        links: [{
            url: String
        }],
        attribute: String, // p: personal, g: group
        isHandInByIndividual: Boolean,
        isRegular: Boolean,
        isCatCustom: Boolean,
        categories: [{
            name: String,
            member: [{
                studentID: String,
                studentName: String,
                memberId: String, // To make sure same person
            }]
        }],
        isAnalysis: Boolean,
        analysis: {
            figJam: {
                highFreqKeywords: [String],
                funcUsage: [{
                    name: String,
                    times: String
                }],
                cats: [{
                    name: String,
                    catId: String,
                    keywords: [String],
                    patterns: [{
                        tools: [String],
                        stage: String,
                        summary: String,
                        keywords: [String]
                    }],
                    funcUsage: [{
                        name: String,
                        times: String
                    }]
                }]
            }
        }
    }],
    semester: {
        type: String,
        required: true
    }
});

const lessonModal = mongoose.model("lessons"/* 資料表 */, lessonSchema);

module.exports = lessonModal;