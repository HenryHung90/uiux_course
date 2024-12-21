var express = require('express');
var router = express.Router();
const multer = require('multer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const lessonModel = require("../model/lesson");
const semesterModel = require("../model/semester");
const memberModel = require('../model/member');
const submissionModel = require("../model/submission");
const sharp = require('sharp');

const ExcelJS = require('exceljs');
const OpenAI = require('openai');
const { title } = require('process');
const { error } = require('console');
let now;
// For ai analysis
const aiAnaPrompts = require("../modules/aiAnaPrompts");

const openai = new OpenAI({ apiKey: process.env.GPT_API_KEY });
async function gptReq(imgArray = [], prompt = '') {
    try {
        const imagesContent = imgArray.map(img => ({
            type: "image_url",
            image_url: {
                url: img
            }
        }));
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: prompt
                },
                {
                    role: "user",
                    content: imagesContent
                },
            ],
            max_tokens: 2048
        });
        console.log("GPT response: " + JSON.stringify(response.choices[0]));
        return response.choices[0];
    } catch (error) {
        now = Date.now();
        console.log("Error in gpt query: ", error, now);
        throw error;
    }
}

async function gptReqTxt(userData = '', prompt = '') {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: prompt
                },
                {
                    role: "user",
                    content: userData
                },
            ],
            max_tokens: 2048
        });
        console.log("GPT response: " + JSON.stringify(response.choices[0]));
        return response.choices[0];
    } catch (error) {
        now = Date.now();
        console.log("Error in gpt query txt: ", error, now);
        throw error;
    }
}

async function processImagesSequentially(base64Files, prompt) {
    for (const base64File of base64Files) {
        try {
            let gptRes = await gptReq(base64File, prompt);
        } catch (error) {
            console.error("Error processing image:", error);
        }
    }
}

// 登入確認 middleware
const isAuth = (req, res, next) => {
    if (!req.session.isAuth) {
        console.log("Doesn't have the permission");
        return res.redirect("/auth/?err=請先（重新）登入❗️");
    }
    next();
}
const isTeacher = (req, res, next) => {
    if (!req.session.isTeacher) {
        console.log("Doesn't have the permission");
        return res.redirect("/auth/?err=請使用老師帳號登入❗️");
    }
    next();
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { name, semester } = req.body;
        const files = req.files;
        if (files && files.length > 0) {
            let userDir = `uploads/${semester}`;
            if (req.session.isTeacher) {
                userDir += `/t/${name}`;
            } else {
                userDir += `/s/${name}`;
            }
            req.uploadDir = userDir;

            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }
        }
        cb(null, req.uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

router.post('/addLesson', isAuth, isTeacher, upload.any('files'), async function (req, res, next) {
    try {
        const files = req.files;
        // const { name, hws, semester } = req.body;
        const { name, links, semester } = req.body;
        if (!name || !semester) {
            res.status(400).send("No lesson name or semester.");
        }
        let fileInfos = [];
        if (files && files.length > 0) {
            const filePromises = files.map(file => {
                const { path, originalname, mimetype } = file;

                return new Promise(async (resolve, reject) => {
                    fs.readFile(path, (err, data) => {
                        if (err) {
                            return reject(err);
                        }

                        const fileInfo = {
                            name: originalname,
                            path: path,
                            contentType: mimetype
                        };

                        resolve(fileInfo);
                    });
                });
            });
            fileInfos = await Promise.all(filePromises);
        }
        const newLesson = new lessonModel({
            name,
            // hws: JSON.parse(hws),
            links: JSON.parse(links),
            semester,
            files: fileInfos
        });

        await newLesson.save();
        console.log('File uploaded and lesson created successfully.')
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading the file.');
    }
});

router.post("/updateLessonName", isAuth, isTeacher, async function (req, res, next) {
    const { lessonId, title } = req.body;
    try {
        await lessonModel.updateOne({ _id: lessonId }, {
            $set: { name: title }
        });

        const updatedLesson = await lessonModel.findById(lessonId);
        if (updatedLesson) {
            res.send(JSON.stringify({ "savedTitle": updatedLesson.name }));
        } else {
            throw error(`更新後找不到 Lesson, Id: ${lessonId}`);
        }
    } catch (error) {
        console.error("更新單元名稱失敗： " + error);
        res.sendStatus(500);
    }
})

router.post("/updateMatName", isAuth, isTeacher, async function (req, res, next) {
    const { lessonId, matId, title } = req.body;
    try {
        await lessonModel.updateOne({ _id: lessonId, 'files._id': matId }, {
            $set: { 'files.$.name': title }
        });

        const updatedLesson = await lessonModel.findById(lessonId, 'files'); // 用欄位投影，只回傳 file 欄位
        if (updatedLesson) {
            const updatedFile = updatedLesson.files.find(file => file._id.toString() === matId);
            if (updatedFile) {
                res.send(JSON.stringify({ "savedTitle": updatedFile.name }));
            } else {
                throw error(`更新後找不到 file, Id: ${matId}`);
            }
        } else {
            throw error(`更新後找不到 Lesson, Id: ${lessonId}`);
        }
    } catch (error) {
        console.error("更新單元名稱失敗： " + error);
        res.sendStatus(500);
    }
})

router.post("/deleteLesson", isAuth, isTeacher, async function (req, res, next) {
    const { lessonId } = req.body;
    let errStr = "";
    try {
        // Find the lesson by id
        const lesson = await lessonModel.findById(lessonId);
        if (!lesson) {
            now = Date.now();
            console.log(`單元找不到 ${now}`);
            return res.status(404).send("單元找不到\n" + now);
        }

        // Delete file from disk storage
        // await Promise.all(
        //     lesson.files.map(async (file) => {
        //         try {
        //             await fsPromises.unlink(file.path);
        //         } catch(error) {
        //             console.log(`Delete file ${file.name} error, ${error}`);
        //             errStr += `檔案 ${file.name} 刪除失敗\n`;
        //         }
        //     }
        // ));

        try {
            const lessonDir = `uploads/${lesson.semester}/t/${lesson.name}`;
            if (fs.existsSync(lessonDir)) {
                await fsPromises.rm(lessonDir, { recursive: true });
            }
        } catch (error) {
            console.error(`Error deleting directory ${dirPath}:`, error);
            errStr += `刪除目錄 ${dirPath} 失敗\n`;
        }

        await lessonModel.findByIdAndDelete(lessonId);

        // Error check
        if (errStr.length > 0) {
            throw new Error(errStr);
        } else {
            res.sendStatus(200);
        }
    } catch (error) {
        console.log("Delete lesson error:\n", error.message);
        res.status(500).send("單元刪除失敗：\n" + error.message);
    }
})

// router.post("/fetchLessons", isAuth, isTeacher, async function(req, res, next) {
//     try {
//         const lessons = await Lesson.find();
//         res.send(JSON.stringify(lessons));
//     } catch(e) {
//         console.log("Finding lessons error: ", e);
//     }
// });
router.post("/fetchLessons", isAuth, async function (req, res, next) {
    try {
        const { semester } = req.body;
        const lessons = await lessonModel.find({ semester });
        res.send(JSON.stringify(lessons));
    } catch (e) {
        console.log("Finding lessons error: ", e);
    }
});

router.post("/addMat", isAuth, isTeacher, upload.any('files'), async function (req, res, next) {
    const files = req.files;
    const { id, links } = req.body;
    let fileInfos = [];

    try {
        if (files && files.length > 0) {
            const filePromises = files.map(file => {
                const { path, originalname, mimetype } = file;

                return new Promise(async (resolve, reject) => {
                    fs.readFile(path, (err, data) => {
                        if (err) {
                            return reject(err);
                        }

                        const fileInfo = {
                            name: originalname,
                            path: path,
                            contentType: mimetype
                        };

                        resolve(fileInfo);
                    });
                });
            });
            fileInfos = await Promise.all(filePromises);
        }

        await lessonModel.updateOne({ _id: id }, {
            $push: {
                files: fileInfos,
                links: JSON.parse(links)
            }
        })
        console.log("Add material success");
        res.sendStatus(201);
    } catch (error) {
        console.error("Add material failed: ", error);
        res.sendStatus(500);
    }
})

router.post("/deleteMat", isAuth, isTeacher, async function (req, res, next) {
    const { lesson_id, file_id, link_id } = req.body;
    try {
        if (file_id) {
            const file = await lessonModel.findOne({ _id: lesson_id, 'files._id': file_id }, { "files.$": 1 });
            if (fs.existsSync(file.files[0].path)) {
                await fsPromises.rm(file.files[0].path, { recursive: true });
            }
            await lessonModel.updateOne({ _id: lesson_id }, {
                $pull: {
                    files: { _id: file.files[0]._id }
                }
            })
        } else {
            await lessonModel.updateOne({ _id: lesson_id }, {
                $pull: {
                    links: { _id: link_id }
                }
            })
        }
        res.sendStatus(200);
    } catch (error) {
        console.error("Delete material error: ", error);
        console.trace();
        res.sendStatus(500);
    }
})

router.post("/addHw", isAuth, isTeacher, upload.any('files'), async function (req, res, next) {
    try {
        const files = req.files;
        let fileInfos = [];
        const {
            id,
            hwName,
            description,
            links,
            attribute,
            isHandInByIndividual,
            isRegular,
            isAnalysis,
            isCatCustom,
            categories
        } = req.body;
        // files
        if (files && files.length > 0) {
            const filePromises = files.map((file) => {
                const { path, originalname, mimetype } = file;

                return new Promise(async (resolve, reject) => {
                    fs.readFile(path, (err, data) => {
                        if (err) {
                            return reject(err);
                        }

                        const fileInfo = {
                            name: originalname,
                            path: path,
                            contentType: mimetype
                        }

                        resolve(fileInfo);
                    })
                })
            })
            fileInfos = await Promise.all(filePromises);
        }

        await lessonModel.updateOne({ _id: id }, {
            $push: {
                hws: {
                    name: hwName,
                    description,
                    files: fileInfos,
                    links: links ? JSON.parse(links) : {},
                    attribute,
                    isHandInByIndividual,
                    isRegular,
                    isCatCustom,
                    categories: categories ? JSON.parse(categories) : {},
                    isAnalysis
                }
            }
        })

        // Retrieve the newly created homework ID
        const updatedLesson = await lessonModel.findById(id);
        const newHomework = updatedLesson.hws[updatedLesson.hws.length - 1]; // Last added homework
        const hwId = newHomework._id;

        // Create and save the new submission record
        const newSubmissionRecord = new submissionModel({
            hwId: hwId
        });

        await newSubmissionRecord.save();

        res.sendStatus(200);
    } catch (error) {
        now = Date.now();
        console.error(`Add homework error\n${error.stack()}\n${now}`);
        res.sendStatus(500).send(`Add homework error\n${now}`);
    }
});

router.post("/updtHw", isAuth, isTeacher, upload.any('newFiles'), async (req, res) => {
    try {
        const {
            lessonId,
            hwId,
            hwName,
            description,
            links,
            attribute,
            isAnalysis,
            isHandInByIndividual,
            isRegular,
            isCatCustom,
            categories,
            deleteFiles
        } = req.body;

        const lesson = await lessonModel.findOne({ _id: lessonId });
        if (!lesson) {
            now = Date.now();
            console.log(`單元找不到\n${now}`);
            res.status(404).send(`單元找不到\n${now}`);
        }

        const hw = lesson.hws.find(hw => hw._id == hwId);
        if (!hw) {
            now = Date.now();
            console.log(`作業找不到\n${now}`);
            res.status(404).send(`作業找不到\n${now}`);
        }

        // 更新基本欄位
        if (hwName) hw.name = hwName;
        if (description) hw.description = description;
        if (attribute) hw.attribute = attribute;
        hw.isAnalysis = isAnalysis === "true";
        hw.isHandInByIndividual = isHandInByIndividual === "true";
        hw.isRegular = isRegular === "true";
        hw.isCatCustom = isCatCustom === "true";

        // 更新連結
        if (links) {
            const parsedLinks = JSON.parse(links);
            hw.links = parsedLinks;
        }

        // 更新主題分類
        if (categories) {
            const parsedCategories = JSON.parse(categories);
            hw.categories = parsedCategories;
        }

        // 處理新增的檔案
        if (req.files) {
            req.files.forEach(file => {
                hw.files.push({
                    name: file.originalname,
                    path: file.path,
                    contentType: file.mimetype
                });
            });
        }

        // 處理刪除的檔案
        if (deleteFiles) {
            const filesToDelete = JSON.parse(deleteFiles);
            hw.files = hw.files.filter(file => {
                if (filesToDelete.includes(file._id.toString())) {
                    // 刪除檔案
                    fs.unlink((file.path), err => {
                        if (err) console.error(`作業更新失敗 - 檔案刪除錯誤:\n${err.stack}\n${Date.now()}`);
                    });
                    return false;
                }
                return true;
            });
        }

        await lesson.save();
        res.sendStatus(200);
    } catch (error) {
        now = Date.now();
        console.log(`更新作業失敗:\n${error.stack}\n${now}`);
        res.send(500).status();
    }
});

router.post("/getHwInfo", isAuth, isTeacher, async function (req, res, next) {
    try {
        const { lessonId, hwId } = req.body;

        const hwObj = await lessonModel.findOne({ _id: lessonId, 'hws._id': hwId }, { 'hws.$': 1 }); // .$ 符合的文，1 返回，0 不返回
        const hw = hwObj.hws[0];
        if (!hw) {
            now = Date.now();
            console.log("作業找不到 " + now);
            return res.status(404).send("作業找不到\n" + now);
        }

        res.send(JSON.stringify(hw));
    } catch (error) {
        now = Date.now();
        console.error(`Get homework error\n${error.stack}\n${now}`);
        res.status(500).send('作業找不到\n' + now);
    }
});

router.post("/rmHw", isAuth, isTeacher, async function (req, res, next) {
    const { lessonId, homeworkId } = req.body;
    let errStr = "";
    try {
        // Find the lesson by id
        const hwObj = await lessonModel.findOne({ _id: lessonId, 'hws._id': homeworkId }, { 'hws.$': 1 }); // .$ 符合的文，1 返回，0 不返回
        const hw = hwObj.hws[0];
        if (!hw) {
            now = Date.now();
            console.log("作業找不到 " + now);
            return res.status(404).send("作業找不到\n" + now);
        }

        // File
        if (hw.files && hw.files.length > 0) {
            try {
                await Promise.all(hw.files.map(async (file) => {
                    if (fs.existsSync(file.path)) {
                        await fsPromises.rm(file.path, { recursive: true });
                    }
                }))
            } catch (error) {
                console.error(`Error deleting file :`, error);
                errStr += `刪除檔案失敗\n`;
            }
        }

        await lessonModel.updateOne(
            { _id: lessonId },
            { $pull: { hws: { _id: homeworkId } } }
        )

        // Error check
        if (errStr.length > 0) {
            throw new Error(errStr);
        } else {
            res.sendStatus(200);
        }
    } catch (error) {
        console.log("Delete homework error:\n", error.message);
        res.sendStatus(500);
    }
})

router.post('/fetchHomework', isAuth, isTeacher, async function (req, res, next) {
    try {
        const { semester_id, hw_id, attribute } = req.body;
        // Add student into submission db (who doesn't submit)
        // Find all student in current semester
        const studentsInSemester = await memberModel.find({
            isTeacher: false,
            semester: semester_id
        });
        console.log("studentsInSemester: "+studentsInSemester);

        // Find submission in given hws
        let submissionArea = await submissionModel.findOne({ hwId: hw_id });

        if (!submissionArea) {
            // Create and save the new submission record
            const newSubmissionRecord = new submissionModel({
                hwId: hw_id
            });

            await newSubmissionRecord.save();
            submissionArea = await submissionModel.findOne({ hwId: hw_id });
        }

        let studentsWithNoSubmissions = [];

        // Extract student IDs who have already submitted
        const submittedStudentIds = submissionArea.submissions.map(submission => submission.studentId);
        // Filter out students who haven't submitted
        studentsWithNoSubmissions = studentsInSemester.filter(student => !submittedStudentIds.includes(student.studentID));
        console.log("studentsWithNoSubmissions: "+studentsWithNoSubmissions);

        // Prepare submissions for students with no submissions
        const newSubmissions = studentsWithNoSubmissions.map(student => ({
            isHandIn: false,
            studentId: student.studentID,
            studentName: student.name,
            handInData: {
                links: [],
                files: []
            },
            category: {
                name: '',
                catId: '',
            },
            feedback: '',
            score: 0,
            analysis: {
                result: []
            }
        }));
        console.log("Before push data");
        submissionArea.submissions.push(...newSubmissions);
        console.log("after push data");
        
        await submissionArea.save();
        console.log("after save data");
        // Query and res result
        let updateSubmissions;
        if (attribute == 'p') {
            updateSubmissions = await submissionModel.findOne({ hwId: hw_id });
        } else {
            updateSubmissions = await submissionModel.aggregate([
                {
                    $match: { hwId: hw_id }
                },
                {
                    $unwind: "$submissions"
                },
                {
                    $group: {
                        _id: "$submissions.category.catId",
                        // Push same group of submission into an array
                        submissions: { $push: "$submissions" }
                    }
                }
            ])
        }
        res.send(JSON.stringify(updateSubmissions));
    } catch (error) {
        now = Date.now();
        console.error(`Error fetching hand ins.\n${error.stack}\n${now}`);
        return res.status(500).send('Error fetching hand ins.\n' + now);
    }
});

router.post("/lesson/submitGrade", isAuth, isTeacher, async (req, res, next) => {
    const { hwId, keepStatus, data } = req.body;
    let dataObj = JSON.parse(data);
    console.log(hwId, keepStatus, typeof dataObj, dataObj);
    try {
        // Update the submitStatus first
        await submissionModel.updateOne({ hwId }, {
            $set: {
                submitStatus: keepStatus
            }
        });

        // Prepare bulk updates for submissions
        const bulkOps = dataObj.map(submission => {
            const updateFields = {};

            if (submission.feedback !== undefined) {
                updateFields["submissions.$.feedback"] = submission.feedback;
            }

            if (submission.score !== undefined) {
                updateFields["submissions.$.score"] = submission.score;
            }
            return {
                updateOne: {
                    filter: { hwId, "submissions.studentId": submission.studentId },
                    update: {
                        $set: updateFields
                    }
                }
            }
        });

        // Execute all bulk operations at once
        await submissionModel.bulkWrite(bulkOps);

        res.sendStatus(200);
    } catch (error) {
        now = Date.now();
        console.log("SubmitGrade error:  " + error.stack + now);
        return res.status(500).send('SubmitGrade error.\n' + now);
    }
});

router.post("/exportGrades", isAuth, isTeacher, async (req, res) => {
    const { hwId, hwName } = req.body;
    try {
        const submission = await submissionModel.findOne({ hwId });
        if (!submission) {
            now = Date.now();
            console.log(`輸出成績錯誤: 找不到作業繳交資料`);
            return res.status(404).send('輸出成績錯誤: 找不到作業繳交資料.\n' + now);
        }

        // Create excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${hwName}成績`);

        worksheet.columns = [
            { header: "學號", key: "sId" },
            { header: "姓名", key: "sName" },
            { header: "成績", key: "sGrade" },
            { header: "評語", key: "sFeedback" },
            { header: "主題", key: "sCategory" },
        ]

        submission.submissions.forEach((sub) => {
            worksheet.addRow({
                sId: sub.studentId,
                sName: sub.studentName,
                sGrade: sub.score,
                sFeedback: sub.feedback,
                sCategory: sub.category.name || ''
            });
        });

        // Set column width based on the longest value
        worksheet.columns.forEach((column) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const cellValue = cell.value ? String(cell.value) : '';
                maxLength = Math.max(maxLength, cellValue.length);
            });
            // Set width to the longest value length with some padding (e.g., +2)
            column.width = maxLength + 15;
        });

        // Set font size 
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                if (rowNumber == 1) {  // Skip the first row (header)
                    cell.font = { size: 16, bold: true }; // Set font size and make it bold
                    return;
                }
                cell.font = { size: 15 };  // Set font size for each cell in the row
            });
        });

        worksheet.views = [
            {
                state: 'frozen', // Freeze rows and columns
                xSplit: 0, // Horizontal split position (none in this case)
                ySplit: 1, // Freeze at row 1 (header row)
                topLeftCell: 'A2', // Top-left cell (first visible cell after freeze)
            },
        ];


        // 告訴瀏覽器，返回 excel 檔案
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        // Sanitize the hwName to ensure it is safe for HTTP headers
        let sanitizedHwName = hwName.replace(/[^a-zA-Z0-9_\-\.]/g, '_'); // Replace unsafe characters
        const encodedFilename = encodeURIComponent(`${sanitizedHwName}成績.xlsx`);
        // 告訴瀏覽器，觸發檔案下載，不是頁面顯示檔案，並指定下載檔名
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        now = Date.now();
        console.log(`輸出成績錯誤: ${error.stack} ${now}`);
        return res.status(500).send('輸出成績錯誤.\n' + now);
    }
})

router.post('/lesson/getGroupList', isAuth, isTeacher, async (req, res, next) => {
    try {
        const { lesson_id, hw_id } = req.body;
        const hwObj = await lessonModel.findOne({ _id: lesson_id, 'hws._id': hw_id }, { 'hws.$': 1 });
        const hw = hwObj.hws[0];
        if (!hw) {
            now = Date.now();
            console.log("作業找不到 " + now)
            return res.status(404).send("作業找不到\n" + now);
        }
        let rtnMap = {};
        rtnMap.title = hw.name;
        rtnMap.categories = hw.categories;

        res.send(JSON.stringify(rtnMap));
    } catch (error) {
        now = Date.now();
        console.log(`Error fetching groupList: ${error.stack} ${now}`);
        return res.status(500).send('Error fetching groupList.\n' + now);
    }
});

router.post('/addSemester', isAuth, isTeacher, async function (req, res, next) {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).send("No semester.");
        }
        let semesterID = name + Date.now();
        const newSemester = new semesterModel({
            name,
            id: semesterID
        });

        await newSemester.save();
        console.log('Semester created successfully.')
        res.sendStatus(201);
    } catch (error) {
        now = Date.now();
        console.log(`Error uploading the file: ${error.stack} ${now}`);
        return res.status(500).send('Error uploading the file.\n' + now);
    }
});

router.post("/fetchSemesters", isAuth, isTeacher, async function (req, res, next) {
    try {
        const semester = await semesterModel.find().sort({ name: -1 });
        res.send(JSON.stringify(semester));
    } catch (e) {
        now = Date.now();
        console.log(`Finding lessons error: ${error.stack} ${now}`);
        return res.status(500).send('Finding lessons error.\n' + now);
    }
});

router.post("/fetchSemesters/stu", isAuth, async function (req, res, next) {
    try {
        let stu = await memberModel.findOne({ email: req.session.email });
        let semesters = await Promise.all(
            stu.semester.map(async s => {
                let semester = await semesterModel.findOne({ id: s });
                return semester;
            })
        );
        res.send(JSON.stringify(semesters));
    } catch (e) {
        now = Date.now();
        console.log(`Finding lessons error: ${error} ${now}`);
        return res.status(500).send('Finding lessons error.\n' + now);
    }
});

//===== Student
// 加入學期
router.get('/join/', isAuth, async function (req, res, next) {
    const sCode = req.query.s_code;
    try {
        let semester = await semesterModel.findOne({ id: sCode });
        if (!semester) {
            return res.redirect("/?err=學期代碼錯誤");
        }
        const result = await memberModel.updateOne({ email: req.session.email }, {
            $addToSet: {
                semester: req.query.s_code
            },
            $set: {
                currentSemester: req.query.s_code
            }
        });
        console.log("Update result: " + result);
        res.redirect("/?msg=課程加入成功！");
    } catch (error) {
        now = Date.now();
        console.error('Error updating member:', error, now);
        res.redirect("/?err=學期加入失敗：系統錯誤\n" + now);
    }
});

/// 分組 ///
// 新增組別（主題）
router.post('/createCat', isAuth, async function (req, res, next) {
    let stu = await memberModel.findOne({ email: req.session.email });
    const { lessonId, hwId, catName } = req.body;
    try {
        // Find the lesson by lessonId
        const lesson = await lessonModel.findOne({ _id: lessonId });

        if (!lesson) {
            now = Date.now();
            console.log("Lesson not found " + now);
            return res.status(404).send('Lesson not found\n' + now);
        }

        // Find the homework (hws) by hwId
        const hw = lesson.hws.id(hwId);

        if (!hw) {
            now = Date.now();
            console.log("Homework not found " + now);
            return res.status(404).send('Homework not found\n' + now);
        }

        const isStuInAnyCategory = hw.categories.some(category => {
            category.member.some(member => member.memberId.toString() === stu._id.toString())
        });

        if (isStuInAnyCategory) {
            now = Date.now();
            console.log("Student already exists in one of the categories " + now);
            return res.status(400).send('Student already exists in one of the categories\n' + now);
        }

        hw.categories.push({
            name: catName,
            member: [{
                studentID: stu.studentID,
                studentName: stu.name,
                memberId: stu._id,
            }
            ]
        });

        await lesson.save();
        return res.sendStatus(200);
    } catch (error) {
        now = Date.now();
        console.log(`新增組題（主別）錯誤 : ${error} ${now}`);
        return res.status(500).send('新增組題（主別）錯誤.\n' + now);
    }
});
router.get('/joinCategory', isAuth, async function (req, res, next) {
    let stu = await memberModel.findOne({ email: req.session.email });
    const { semester, lessonId, hwId, catId } = req.query;
    try {
        try {
            // check category exist
            const lesson = await lessonModel.findOne({
                semester,
                "_id": lessonId,
                "hws._id": hwId,
                "hws.categories._id": catId
            });
            if (!lesson) {
                throw "找不到主題";
            }
        } catch (error) {
            now = Date.now();
            console.log(`確認主題錯誤： ${error} ${now}`);
            return res.redirect("/?err=確認主題錯誤 😢\n" + now);
        }

        await lessonModel.updateOne({ semester, _id: lessonId, "hws._id": hwId, "hws.categories._id": catId },
            {
                $push: {
                    "hws.$[hw].categories.$[category].member": {
                        studentID: stu.studentID,
                        studentName: stu.name,
                        memberId: stu._id, // To make sure same person
                    }
                }
            },
            {
                arrayFilters: [
                    { "hw._id": hwId }, // 跟上面配對 `hws`
                    { "category._id": catId }  // 跟上面配對 `categories` 
                ]
            });
        res.redirect("/?msg=主題加入成功！🤟🏻");
    } catch (error) {
        now = Date.now();
        console.log(`主題加入失敗： ${error} ${now}`);
        return res.redirect("/?err=主題加入失敗：請稍候再試 💦\n" + now);
    }
});

router.post("/lesson/submitHomework", isAuth, upload.any('files'), async (req, res, next) => {
    try {
        let stu = await memberModel.findOne({ email: req.session.email });
        const files = req.files;
        let fileInfos = [];
        const { semester, hwId, links, catName, catId } = req.body;

        // 處理上傳文件
        if (files && files.length > 0) {
            const filePromises = files.map((file) => {
                const { path, originalname, mimetype } = file;
                return new Promise((resolve, reject) => {
                    fs.readFile(path, (err, data) => {
                        if (err) return reject(err);
                        const fileInfo = {
                            name: originalname,
                            path: path,
                            contentType: mimetype
                        };
                        resolve(fileInfo);
                    });
                });
            });
            fileInfos = await Promise.all(filePromises);
        }

        // 查找作業
        const hwObj = await lessonModel.findOne({ semester, 'hws._id': hwId }, { 'hws.$': 1 });
        const hw = hwObj.hws[0];
        if (!hw) {
            console.log("找不到作業 " + Date.now());
            return res.status(404).send("找不到作業\n" + Date.now());
        }

        if (hw.attribute === 'g' && !hw.isHandInByIndividual) {
            let category = hw.categories.id(catId);
            if (!category) {
                console.log('找不到組別 ' + Date.now());
                return res.status(404).send('找不到組別，請先加入、新增組別！\n' + Date.now());
            }

            for (let member of category.member) {
                let newSubmissionData = {
                    studentId: member.studentID,
                    isHandIn: true,
                    studentName: member.studentName,
                    handInData: { links: JSON.parse(links), files: fileInfos },
                    category: { name: category.name, catId: category._id },
                    analysis: { result: [] }
                };

                const result = await submissionModel.updateOne(
                    { hwId: hwId, "submissions.studentId": member.studentID },
                    {
                        $set: {
                            "submissions.$.isHandIn": newSubmissionData.isHandIn,
                            "submissions.$.handInData": newSubmissionData.handInData,
                            "submissions.$.category": newSubmissionData.category,
                            "submissions.$.analysis": newSubmissionData.analysis,
                        }
                    },
                    { upsert: false }
                );

                if (result.modifiedCount === 0) {
                    await submissionModel.updateOne(
                        { hwId: hwId },
                        { $push: { submissions: newSubmissionData } },
                        { upsert: false, new: true }
                    );
                }
            }

            // Re query submission
            const submissions = await submissionModel.findOne({ hwId });
            const submission = submissions.submissions.find(sub => sub.studentId == stu.studentID);
            res.status(200).send({ submissionId: submission._id });
        } else {
            let newSubmissionData = {
                studentId: stu.studentID,
                isHandIn: true,
                studentName: stu.name,
                handInData: { links: JSON.parse(links), files: fileInfos },
                category: { name: catName, catId },
                analysis: { result: [] }
            };

            const result = await submissionModel.updateOne(
                { hwId: hwId, "submissions.studentId": stu.studentID },
                {
                    $set: {
                        "submissions.$.isHandIn": newSubmissionData.isHandIn,
                        "submissions.$.handInData": newSubmissionData.handInData,
                        "submissions.$.category": newSubmissionData.category,
                        "submissions.$.analysis": newSubmissionData.analysis,
                    }
                },
                { upsert: false }
            );

            if (result.modifiedCount === 0) {
                await submissionModel.updateOne(
                    { hwId: hwId },
                    { $push: { submissions: newSubmissionData } },
                    { upsert: false, new: true }
                );
            }

            // Re query submission
            const submissions = await submissionModel.findOne({ hwId });
            const submission = submissions.submissions.find(sub => sub.studentId == stu.studentID);
            res.status(200).send({ submissionId: submission._id });
        }
    } catch (error) {
        console.log(`Homework submit error： ${error} ${Date.now()}`);
        return res.status(500).send("/?err=Homework submit error\n" + Date.now());
    }
});


router.post("/lesson/rmHomeworkSubmission", isAuth, async (req, res) => {
    const { type, hwId, submissionId, objId } = req.body;
    try {
        if (!objId) {
            now = Date.now();
            console.log(`刪除作業連結 / 檔案失敗：沒有傳入 link 或 file Id\n${now}`);
            res.status(500).send(`刪除作業連結 / 檔案失敗：\n\n${now}`);
            return;
        }

        const submission = await submissionModel.findOne({ hwId });
        const subDoc = submission.submissions.id(submissionId);
        if (!submission) {
            now = Date.now();
            console.log(`刪除檔案失敗：找不到 Submission${now}`);
            return res.status(404).status(`刪除檔案失敗：找不到提交作業資訊${now}`);
        }

        // type - 0: file, 1: link
        if (type == 0) {
            const file = subDoc.handInData.files.id(objId);
            if (!file) {
                now = Date.now();
                console.log(`刪除檔案失敗：找不到檔案資料${now}`);
                return res.status(404).status(`刪除檔案失敗：找不到檔案資料${now}`);
            }

            subDoc.handInData.files.pull({ _id: objId });
            await submission.save();

            // Remove the actual file from the file system
            try {
                await removeFile(path.resolve(file.path));
                console.log("File deleted from local storage:", file.path);
            } catch (fsError) {
                now = Date.now();
                console.error("Failed to delete file from local storage:", fsError + now);
            }
        } else {
            // Use pull to remove the link by its _id
            subDoc.handInData.links.pull({ _id: objId });
            await submission.save();
        }
        res.sendStatus(200);
    } catch (error) {
        now = Date.now();
        console.log(`刪除作業連結 / 檔案失敗：\n${error.stack}\n${now}`);
        res.status(500).send(`刪除作業連結 / 檔案失敗：\n\n${now}`);
    }
});

router.post("/lesson/getPersonalSubmissions", isAuth, async (req, res, next) => {
    try {
        let student = await memberModel.find({ email: req.session.email });
        student = student[0];
        let submissions = await submissionModel.find({
            "submissions.studentId": student.studentID
        });
        const personalSubmissions = {
            studentId: student.studentID,
            // TODO 將 score 根據送出狀態回傳
            submissions: submissions.flatMap(doc =>
                doc.submissions
                    .filter(sub => sub.studentId === student.studentID)
                    .map(sub => ({
                        ...sub.toObject(),  // 將 submission 轉為對象
                        hwId: doc.hwId,      // 將 hwId 加入每個 submission 中
                        submitStatus: doc.submitStatus
                    }))
            )
        };
        res.send(JSON.stringify(personalSubmissions));
    } catch (error) {
        now = Date.now();
        console.log(`Error getting the personal submission： ${error} ${now}`);
        return res.status(500).send("/?err=Error getting the personal submission.\n" + now);
    }
});

router.post("/aiAnalyze", async (req, res) => {
    const { anaType, hwId, submissionId, semesterName } = req.body;
    try {
        switch (anaType) {
            case 'byCat':
                try {
                    let submitHw = await submissionModel.findOne({ hwId, "submissions._id": submissionId }, { 'submissions.$': 1 });
                    submitHw = submitHw.submissions[0];
                    console.log(submitHw.handInData.files);
                    if (submitHw.handInData.files.length < 1) {
                        now = Date.now();
                        console.log("No files to analyze. " + now);
                        res.status(500).send("No files to analyze.\n" + now);
                        return;
                    }
                    // Compress and convert each image to base64
                    const base64Files = await Promise.all(submitHw.handInData.files.map(async (file) => {
                        return await compressImageToBase64(file.path);
                    }));
                    console.log(base64Files);
                    // AI Analysis
                    let gptRes = await gptReq(base64Files,
                        aiAnaPrompts.catPrompt(submitHw.category.name).content.replace(/\n+/g, '').trim());
                    let resContent = JSON.parse(gptRes.message.content.replace("```json", "").replace("```", ""));
                    await submissionModel.updateOne(
                        { hwId, "submissions._id": submissionId },
                        {
                            $set: {
                                "submissions.$.analysis.result": [{
                                    title: "關鍵字",
                                    content: resContent.keywords
                                }]
                            }
                        }
                    );
                    const updateResponse = await lessonModel.updateOne(
                        { "hws._id": hwId },
                        {
                            $set: {
                                "hws.$.analysis.figJam.cats.$[cat].name": submitHw.category.name,
                                "hws.$.analysis.figJam.cats.$[cat].keywords": resContent.keywords,
                                "hws.$.analysis.figJam.cats.$[cat].patterns": resContent.patterns,
                                "hws.$.analysis.figJam.cats.$[cat].funcUsage": resContent.funcUsage
                            }
                        },
                        {
                            arrayFilters: [{ "cat.catId": submitHw.category.catId }]
                        }
                    );
                    if (updateResponse.modifiedCount === 0) {
                        await lessonModel.updateOne(
                            { "hws._id": hwId },
                            {
                                $push: {
                                    "hws.$.analysis.figJam.cats": {
                                        catId: submitHw.category.catId,
                                        name: submitHw.category.name,
                                        keywords: resContent.keywords,
                                        patterns: resContent.patterns,
                                        funcUsage: resContent.funcUsage
                                    }
                                }
                            }
                        )
                    }
                    const reQueryData = await submissionModel.findOne({ hwId, "submissions._id": submissionId }, { 'submissions.$': 1 });

                    res.send(JSON.stringify(reQueryData.submissions[0].analysis.result));
                } catch (error) {
                    now = Date.now();
                    console.log(`作業分析錯誤\n${error.stack}\n${now}`);
                    res.status(500).send(`作業分析錯誤\n${now}`);
                }
                break;
            case 'byCourse':
                try {
                    const hwObj = await lessonModel.findOne({ semester: semesterName, 'hws._id': hwId }, { 'hws.$': 1 });
                    const hw = hwObj.hws[0];
                    if (!hw) {
                        now = Date.now();
                        console.log("取得分析結果失敗：找不到作業 " + now);
                        return res.status(404).send("找不到作業\n" + now);
                    }

                    // Course analyze
                    const gptRes = await gptReqTxt(JSON.stringify(hw.analysis.figJam.cats), aiAnaPrompts.coursePrompt.content.replace(/\n+/g, '').trim());
                    let resContent = JSON.parse(gptRes.message.content.replace("```json", "").replace("```", ""));

                    // Save analyze result
                    await lessonModel.updateOne(
                        { "hws._id": hwId },
                        {
                            $set: {
                                "hws.$.analysis.figJam.highFreqKeywords": resContent.highFreqKeywords,
                                "hws.$.analysis.figJam.funcUsage": resContent.funcUsage
                            }
                        }
                    )

                    // Query analyze data from db
                    const reQueryData = await lessonModel.findOne({ semester: semesterName, 'hws._id': hwId }, { 'hws.$': 1 });

                    res.send(JSON.stringify(reQueryData.hws[0].analysis.figJam));
                } catch (error) {
                    now = Date.now();
                    console.log(`全班作業分析錯誤\n${error.stack}\n${now}`);
                    res.status(500).send(`全班作業分析錯誤\n${now}`);
                }
                break;
        }

        res.status(200);
    } catch (error) {
        now = Date.now();
        console.log(`分析錯誤：\n${error.stack}\n${now}`);
        return res.status(500).send("/?err=分析錯誤\n" + now);
    }
})

router.post("/lesson/getAnalysis", async (req, res) => {
    const { semester, hwId } = req.body;

    try {
        const hwObj = await lessonModel.findOne({ semester, 'hws._id': hwId }, { 'hws.$': 1 });
        const hw = hwObj.hws[0];
        if (!hw) {
            now = Date.now();
            console.log("取得分析結果失敗：找不到作業 " + now);
            return res.status(404).send("找不到作業\n" + now);
        }

        res.send(JSON.stringify(hw.analysis.figJam));
    } catch (error) {
        now = Date.now();
        console.log(`取得分析結果失敗： ${error.stack} ` + now);
        res.status(500).send(`取得分析結果失敗\n` + now);
    }
});

//==== Common
// Route to display an individual file based on its ID
router.get('/getHw/:hwId/:fileId', async (req, res) => {
    try {
        const { hwId, fileId } = req.params;
        const submission = await submissionModel.findOne({ hwId: hwId });
        if (!submission) {
            now = Date.now();
            console.log(`Submission not found ` + now);
            return res.status(404).send('Submission not found\n' + now);
        }

        let fileFound = null;

        // Iterate through all the submissions to find the file by fileId
        submission.submissions.forEach(studentSubmission => {
            const file = studentSubmission.handInData.files.find(f => f._id.toString() === fileId);

            if (file) {
                fileFound = file;
            }
        });

        if (!fileFound) {
            now = Date.now();
            console.log('File not found ' + now);
            return res.status(404).send('File not found\n' + now);
        }
        res.sendFile(path.resolve(fileFound.path));
    } catch (error) {
        now = Date.now();
        console.error(`Error retrieving the file from the database. ${error} ${now}`);
        res.status(500).send('Error retrieving the file from the database.\n' + now);
    }
});
router.get('/:lessonId/:fileId', async (req, res) => {
    try {
        const { lessonId, fileId } = req.params;
        const lesson = await lessonModel.findById(lessonId);
        if (!lesson) {
            now = Date.now();
            console.log('Lesson not found ' + now);
            return res.status(404).send('Lesson not found\n' + now);
        }
        const file = lesson.files.id(fileId);
        if (!file) {
            now = Date.now();
            return res.status(404).send('File not found\n' + now);
        }
        res.sendFile(path.resolve(file.path));
    } catch (error) {
        now = Date.now();
        console.log(`Error retrieving the file from the database： ${error} ${now}`);
        return res.status(500).send("/?err=Error retrieving the file from the database\n" + now);
    }
});
// Hw ref file
router.get('/:lessonId/:hwId/:fileId', async (req, res) => {
    try {
        const { lessonId, hwId, fileId } = req.params;
        const lesson = await lessonModel.findById(lessonId);
        if (!lesson) {
            now = Date.now();
            console.log("Lesson not found " + now);
            return res.status(404).send('Lesson not found\n' + now);
        }
        const hw = lesson.hws.id(hwId);
        if (!hw) {
            now = Date.now();
            console.log("Homework not found " + now);
            return res.status(404).send('Homework not found\n' + now);
        }
        let file = hw.files.id(fileId);
        if (!file) {
            now = Date.now();
            console.log("File not found " + now);
            return res.status(404).send('File not found\n' + now);
        }
        res.sendFile(path.resolve(file.path));
    } catch (error) {
        now = Date.now();
        console.error(`Error retrieving the file from the database. ${error} ${now}`);
        res.status(500).send('Error retrieving the file from the database.\n' + now);
    }
});

// Compress Image and Convert to Base64
async function compressImageToBase64(inputPath) {
    const compressedOutputPath = `${inputPath}-compressed.png`;

    try {
        await sharp(inputPath)
            .resize(1920)
            .png({ quality: 100, compressionLevel: 9 })
            .toFile(compressedOutputPath);

        const fileBuffer = fs.readFileSync(compressedOutputPath);
        const base64Data = fileBuffer.toString('base64');
        const mimeType = 'image/png';

        fs.unlinkSync(compressedOutputPath);
        return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
        now = Date.now();
        console.error(`Error compressing image: ${error} ${now}`);
        return res.status(500).send("/?err=Error compressing image\n" + now);
    }
}

const removeFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

module.exports = router;
