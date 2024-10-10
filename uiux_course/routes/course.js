var express = require('express');
var router = express.Router();
const multer = require('multer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const Lesson = require("../model/lesson");
const Semester = require("../model/semester");
const memberModel = require('../model/member');
const submissionModel = require("../model/submission");
const sharp = require('sharp');

const OpenAI = require('openai');
const { title } = require('process');
const { error } = require('console');

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
        console.log("Error in gpt query: ", error);
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
        const newLesson = new Lesson({
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
        await Lesson.updateOne({ _id: lessonId }, {
            $set: { name: title }
        });

        const updatedLesson = await Lesson.findById(lessonId);
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
        await Lesson.updateOne({ _id: lessonId, 'files._id': matId }, {
            $set: { 'files.$.name': title }
        });

        const updatedLesson = await Lesson.findById(lessonId, 'files'); // 用欄位投影，只回傳 file 欄位
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
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).send("單元找不到");
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

        await Lesson.findByIdAndDelete(lessonId);

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
        const lessons = await Lesson.find({ semester });
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

        await Lesson.updateOne({ _id: id }, {
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
            const file = await Lesson.findOne({ _id: lesson_id, 'files._id': file_id }, { "files.$": 1 });
            if (fs.existsSync(file.files[0].path)) {
                await fsPromises.rm(file.files[0].path, { recursive: true });
            }
            await Lesson.updateOne({ _id: lesson_id }, {
                $pull: {
                    files: { _id: file.files[0]._id }
                }
            })
        } else {
            await Lesson.updateOne({ _id: lesson_id }, {
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

        await Lesson.updateOne({ _id: id }, {
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
        const updatedLesson = await Lesson.findById(id);
        const newHomework = updatedLesson.hws[updatedLesson.hws.length - 1]; // Last added homework
        const hwId = newHomework._id;

        // Create and save the new submission record
        const newSubmissionRecord = new submissionModel({
            hwId: hwId
        });

        await newSubmissionRecord.save();

        res.sendStatus(200);
    } catch (error) {
        console.error("Add homework error: ", error);
        console.trace();
        res.sendStatus(500)
    }
});

router.post("/rmHw", isAuth, isTeacher, async function (req, res, next) {
    const { lessonId, homeworkId } = req.body;
    let errStr = "";
    try {
        // Find the lesson by id
        const hwObj = await Lesson.findOne({ _id: lessonId, 'hws._id': homeworkId }, { 'hws.$': 1 }); // .$ 符合的文，1 返回，0 不返回
        const hw = hwObj.hws[0];
        if (!hw) {
            return res.status(404).send("作業找不到");
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

        await Lesson.updateOne(
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
        submissionArea.submissions.push(...newSubmissions);
        await submissionArea.save();
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
        console.log(error);
        res.sendStatus(500).send('Error fetching hand ins.');
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
        console.log("submitGrade error: ", error);
        res.sendStatus(500);
    }
});

router.post('/lesson/getGroupList', isAuth, isTeacher, async (req, res, next) => {
    try {
        const { lesson_id, hw_id } = req.body;
        const hwObj = await Lesson.findOne({ _id: lesson_id, 'hws._id': hw_id }, { 'hws.$': 1 });
        const hw = hwObj.hws[0];
        if (!hw) {
            return res.status(404).send("作業找不到");
        }
        let rtnMap = {};
        rtnMap.title = hw.name;
        rtnMap.categories = hw.categories;

        res.send(JSON.stringify(rtnMap));
    } catch (error) {
        console.log(`Error fetching groupList: ${error}`);
        res.sendStatus(500).send('Error fetching groupList.');
    }
});

router.post('/addSemester', isAuth, isTeacher, async function (req, res, next) {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).send("No semester.");
        }
        let semesterID = name + Date.now();
        const newSemester = new Semester({
            name,
            id: semesterID
        });

        await newSemester.save();
        console.log('Semester created successfully.')
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading the file.');
    }
});

router.post("/fetchSemesters", isAuth, isTeacher, async function (req, res, next) {
    try {
        const semester = await Semester.find().sort({ name: -1 });
        res.send(JSON.stringify(semester));
    } catch (e) {
        console.log("Finding lessons error: ", e);
    }
});

router.post("/fetchSemesters/stu", isAuth, async function (req, res, next) {
    try {
        let stu = await memberModel.findOne({ email: req.session.email });
        let semesters = await Promise.all(
            stu.semester.map(async s => {
                let semester = await Semester.findOne({ id: s });
                return semester;
            })
        );
        res.send(JSON.stringify(semesters));
    } catch (e) {
        console.log("Finding lessons error: ", e);
    }
});

//===== Student
// 加入學期
router.get('/join/', isAuth, async function (req, res, next) {
    const sCode = req.query.s_code;
    try {
        let semester = await Semester.findOne({ id: sCode });
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
        console.error('Error updating member:', error);
        res.redirect("/?err=學期加入失敗：系統錯誤");
    }
});

/// 分組 ///
// 新增組別（主題）
router.post('/createCat', isAuth, async function (req, res, next) {
    let stu = await memberModel.findOne({ email: req.session.email });
    const { lessonId, hwId, catName } = req.body;
    try {
        // Find the lesson by lessonId
        const lesson = await Lesson.findOne({ _id: lessonId });

        if (!lesson) {
            console.log("Lesson not found");
            return res.status(404).json({ message: 'Lesson not found' });
        }

        // Find the homework (hws) by hwId
        const hw = lesson.hws.id(hwId);

        if (!hw) {
            console.log("Homework not found");
            return res.status(404).json({ message: 'Homework not found' });
        }

        const isStuInAnyCategory = hw.categories.some(category => {
            category.member.some(member => member.memberId.toString() === stu._id.toString())
        });

        if (isStuInAnyCategory) {
            console.log("Student already exists in one of the categories");
            return res.status(400).json({ message: 'Student already exists in one of the categories' });
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
        console.error('新增組題（主別）錯誤 :', error);
        res.sendStatus(500).send('新增組題（主別）錯誤');
    }
});
router.get('/joinCategory', isAuth, async function (req, res, next) {
    let stu = await memberModel.findOne({ email: req.session.email });
    const { semester, lessonId, hwId, catId } = req.query;
    try {
        try {
            // check category exist
            const lesson = await Lesson.findOne({
                semester,
                "_id": lessonId,
                "hws._id": hwId,
                "hws.categories._id": catId
            });
            if (!lesson) {
                throw "找不到主題";
            }
        } catch (error) {
            console.log("確認主題錯誤：" + error);
            return res.redirect("/?err=找不到指定的主題 😢");
        }

        await Lesson.updateOne({ semester, _id: lessonId, "hws._id": hwId, "hws.categories._id": catId },
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
        console.error('Error updating member:', error);
        res.redirect("/?err=主題加入失敗：請稍候再試 💦");
    }
});

router.post("/lesson/submitHomework", isAuth, upload.any('files'), async (req, res, next) => {
    try {
        let stu = await memberModel.findOne({ email: req.session.email });
        const files = req.files;
        let fileInfos = [];
        const { semester, hwId, links, catName, catId } = req.body;
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

        // Find the lesson by id
        const hwObj = await Lesson.findOne({ semester, 'hws._id': hwId }, { 'hws.$': 1 });
        const hw = hwObj.hws[0];
        if (!hw) {
            return res.status(404).send("找不到作業");
        }

        // Group hand in
        if (hw.attribute == 'g' && !hw.isHandInByIndividual) {
            let category = hw.categories.id(catId);

            if (!category) {
                return res.status(404).send('Category not found');
            }

            for (let member of category.member) {
                let newSubmissionData = {
                    studentId: member.studentID,
                    isHandIn: true,
                    studentName: member.studentName,
                    handInData: {
                        links: JSON.parse(links),
                        files: fileInfos
                    },
                    category: { name: category.name, catId: category._id },
                    analysis: {
                        result: []
                    }
                };

                const result = await submissionModel.updateOne(
                    { hwId: hwId, "submissions.studentId": member.studentID }, // Query to find specific student submission
                    {
                        $set: {
                            "submissions.$.isHandIn": newSubmissionData.isHandIn,
                            "submissions.$.handInData": newSubmissionData.handInData,
                            "submissions.$.category": newSubmissionData.category,
                            "submissions.$.analysis": newSubmissionData.analysis,
                        }
                    },
                    { upsert: false } // Do not create a new document for this operation
                );

                // If no document was updated (i.e., no existing submission for this student), push a new one
                if (result.modifiedCount === 0) {
                    await submissionModel.updateOne(
                        { hwId: hwId },
                        {
                            $push: {
                                submissions: newSubmissionData // Add the new submission data
                            }
                        },
                        { upsert: false } // Ensure the document exists, but don't create a new one
                    );
                }
            }

            res.sendStatus(200);
        } else {
            let newSubmissionData = {
                studentId: stu.studentID,
                isHandIn: true,
                studentName: stu.name,
                handInData: {
                    links: JSON.parse(links),
                    files: fileInfos
                },
                category: { name: catName, catId },
                analysis: {
                    result: []
                }
            };

            const result = await submissionModel.updateOne(
                // TODO hwId 留一個就好 
                { hwId: hwId, "submissions.studentId": stu.studentID }, // Query to find the specific student submission
                {
                    $set: {
                        // Update data if student submission exists
                        "submissions.$.isHandIn": newSubmissionData.isHandIn,
                        "submissions.$.handInData": newSubmissionData.handInData,
                        "submissions.$.category": newSubmissionData.category,
                        "submissions.$.analysis": newSubmissionData.analysis,
                    }
                },
                { upsert: false } // Do not create a new document for this operation
            );

            // If no document was updated (i.e., no existing submission for this student), push a new one
            if (result.modifiedCount === 0) {
                await submissionModel.updateOne(
                    { hwId: hwId },
                    {
                        $push: {
                            submissions: newSubmissionData // Add the new submission data
                        }
                    },
                    { upsert: false } // Ensure the document exists, but don't create a new one
                );
            }
            res.send(200);
        }
    } catch (error) {
        console.log("Homework submit error: ", error);
        res.sendStatus(500);
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
        console.error(error);
        res.status(500).send('Error getting the personal submission.');
    }
});

router.post("/aiAnalyze", async (req, res) => {
    const { anaType, hwId, submissionId } = req.body;
    try {
        switch (anaType) {
            case 'keyWords':
                let submitHw = await submissionModel.findOne({ hwId, "submissions._id": submissionId }, { 'submissions.$': 1 });
                submitHw = submitHw.submissions[0];
                console.log(submitHw.handInData.files);
                if (submitHw.handInData.files.length < 1) {
                    console.log("No files to analyze.");
                    res.status(500).send("No files to analyze.");
                    return;
                }
                // Compress and convert each image to base64
                const base64Files = await Promise.all(submitHw.handInData.files.map(async (file) => {
                    return await compressImageToBase64(file.path);
                }));
                console.log(base64Files);
                // AI Analysis
                let gptRes = await gptReq(base64Files,
                    "Analyze the uploaded image and extract keywords, focusing on high-frequency terms that are critical for guiding the discussion toward its goal and are related to the subject. Return the result as a JSON string in the format: ```json{'keywords': ['keyword1','keyword2','keyword3',...]}```");
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
                res.send(200);
                break;
        }

        res.status(200);
    } catch (error) {
        res.status(500).send(`分析錯誤： ${error}`);
    }
})

//==== Common
// Route to display an individual file based on its ID
router.get('/getHw/:hwId/:fileId', async (req, res) => {
    try {
        const { hwId, fileId } = req.params;
        const submission = await submissionModel.findOne({ hwId: hwId });
        if (!submission) {
            return res.status(404).send('Submission not found');
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
            return res.status(404).send('File not found');
        }
        res.sendFile(path.resolve(fileFound.path));
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving the file from the database.');
    }
});
router.get('/:lessonId/:fileId', async (req, res) => {
    try {
        const { lessonId, fileId } = req.params;
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).send('Lesson not found');
        }
        const file = lesson.files.id(fileId);
        if (!file) {
            return res.status(404).send('File not found');
        }
        res.sendFile(path.resolve(file.path));
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving the file from the database.');
    }
});
// Hw ref file
router.get('/:lessonId/:hwId/:fileId', async (req, res) => {
    try {
        const { lessonId, hwId, fileId } = req.params;
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            console.log("Lesson not found");
            return res.status(404).send('Lesson not found');
        }
        const hw = lesson.hws.id(hwId);
        if (!hw) {
            console.log("Homework not found");
            return res.status(404).send('Homework not found');
        }
        let file = hw.files.id(fileId);
        if (!file) {
            console.log("File not found");
            return res.status(404).send('File not found');
        }
        res.sendFile(path.resolve(file.path));
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving the file from the database.');
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
        console.error("Error compressing image:", error);
        throw error;
    }
}

module.exports = router;
