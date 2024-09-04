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

// 登入確認 middleware
const isAuth = (req, res, next) => {
    if (!req.session.isAuth) {
        console.log("Doesn't have the permission");
        return res.redirect("/auth/");
    }
    next();
}
const isTeacher = (req, res, next) => {
    if (!req.session.isTeacher) {
        console.log("Doesn't have the permission");
        return res.redirect("/auth/");
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
            isRegular,
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
                    isRegular,
                    isCatCustom,
                    categories: categories ? JSON.parse(categories) : {}
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
                        _id: "submissions.category.catId",
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
    const {hwId, keepStatus, data} = req.body;
    let dataObj = JSON.parse(data);
    console.log(hwId, keepStatus, typeof dataObj);
    try {
        // Update the submitStatus first
        await submissionModel.updateOne({hwId}, {
            $set: {
                submitStatus: keepStatus
            }
        });

        // Prepare bulk updates for submissions
        const bulkOps = dataObj.map(submission => ({
            updateOne: {
                filter: { hwId, "submissions.studentId": submission.studentId },
                update: {
                    $set: {
                        "submissions.$.feedback": submission.feedback,
                        "submissions.$.score": submission.score
                    }
                }
            }
        }));

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

router.post("/lesson/submitHomework", isAuth, upload.any('files'), async (req, res, next) => {
    try {
        let stu = await memberModel.findOne({ email: req.session.email });
        const files = req.files;
        let fileInfos = [];
        const { hwId, links } = req.body;
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

        let newSubmissionData = {
            studentId: stu.studentID,
            isHandIn: true,
            studentName: stu.name,
            handInData: {
                links: JSON.parse(links),
                files: fileInfos
            },
            category: { name: "Category Name", catId: "cat123" }, // TODO 9/3 Start From here
            analysis: {
                result: [{
                }]
            }
        };

        const result = await submissionModel.updateOne(
            { hwId: hwId, "submissions.studentId": stu.studentID }, // Query to find the specific student submission
            {
                $set: {
                    "submissions.$.isHandIn": newSubmissionData.isHandIn,
                    "submissions.$.handInData": newSubmissionData.handInData // Update handInData if student submission exists
                }
            },
            { upsert: false } // Do not create a new document for this operation
        );

        if (result.modifiedCount === 0) {
            // If no document was updated (i.e., no existing submission for this student), push a new one
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
    } catch (error) {
        console.log("Homework submit error: ", error);
        res.sendStatus(500);
    }
});

router.post("/lesson/getPersonalSubmissions", isAuth, async (req, res, next) => {
    try {
        let student = await memberModel.find({email: req.session.email});
        let submissions = await submissionModel.find({
            submissions: {
                $elemMatch: {studentId: student.studentID}
            }
        });
        res.send(JSON.stringify(submissions)); //TODO need check
    } catch (error) {
        console.error(error);
        res.status(500).send('Error getting the personal submission.');
    }
});

//==== Common
// Route to display an individual file based on its ID
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
router.get('/getHw/:hwId/:fileId', async (req, res) => {
    try {
        const { hwId, fileId } = req.params;
        const submission = await submissionModel.findOne({hwId: hwId});
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
module.exports = router;
