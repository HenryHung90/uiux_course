const mongoose = require("mongoose");

const submissionSchema = mongoose.Schema({
    hwId: {
        type: String,
        required: true
    },
    submitStatus: Number,
    submissions: [{
        isHandIn: Boolean,
        studentId: {
            type: String,
            required: true 
        },
        studentName: String,
        handInData: {
            links: [{
                url: String
            }],
            files: [{
                name: String,
                path: String,
                contentType: String
            }]
        },
        category: { // TODO: 需確認小組加入主題運作
            // id: String, //TO_CHECK Not sure
            name: String,
            catId: String,
        },
        feedback: String,
        score: String,
        analysis: {
            result: [{
                title: String,
                content: String
            }]
        }
    }]
});

const submissionModel = mongoose.model("submissions", submissionSchema);

module.exports = submissionModel;