var express = require('express');
var router = express.Router();
const multer = require('multer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const Lesson = require("../model/lesson");
const Semester = require("../model/semester");

// 登入確認 middleware
const isAuth = (req, res, next) =>{
  if(!req.session.isAuth) {
      console.log("Doesn't have the permission");
      return res.redirect("/auth/");
  }
  next();
}
const isTeacher = (req, res, next) =>{
  if(!req.session.isTeacher) {
      console.log("Doesn't have the permission");
      return res.redirect("/auth/");
  }
  next();
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { name, semester } = req.body;
        const files = req.files;
        if(files && files.length > 0) {
            const userDir = `uploads/${semester}/t/${name}`;
            req.uploadDir = userDir;
    
            if (!fs.existsSync(userDir)){
                fs.mkdirSync(userDir, { recursive: true });
            }
        }
      cb(null, req.uploadDir); 
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({storage: storage});

router.post('/addLesson', isAuth, isTeacher, upload.any('files'), async function(req, res, next) {
    try{
        const files = req.files;
        const { name, hws, semester } = req.body;
        if(!name||!semester) {
            res.status(400).send("No lesson name or semester.");
        }
        let fileInfos = [];
        if(files && files.length > 0) {
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
            hws: JSON.parse(hws),
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

router.post("/deleteLesson", isAuth, isTeacher, async function(req, res, next) {
    const {lessonId} = req.body;
    let errStr = "";
    try {
        // Find the lesson by id
        const lesson = await Lesson.findById(lessonId);
        if(!lesson) {
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
            if(fs.existsSync(lessonDir)) {
                await fsPromises.rm(lessonDir, { recursive: true});
            }
        } catch (error) {
            console.error(`Error deleting directory ${dirPath}:`, error);
            errStr += `刪除目錄 ${dirPath} 失敗\n`;
        }

        await Lesson.findByIdAndDelete(lessonId);
        
        // Error check
        if(errStr.length > 0) {
            throw new Error(errStr);
        } else {
            res.sendStatus(200);
        }
    } catch(error) {
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
router.post("/fetchLessons", isAuth, isTeacher, async function(req, res, next) {
    try {
        const {semester} = req.body;
        const lessons = await Lesson.find({semester});
        res.send(JSON.stringify(lessons));
    } catch(e) {
        console.log("Finding lessons error: ", e);
    }
});

router.post('/addSemester', isAuth, isTeacher, async function(req, res, next) {
    try{
        const { name } = req.body;
        if(!name) {
            res.status(400).send("No semester.");
        }
        const newSemester = new Semester({
            name,
            id: name+Date.now()
        });
        
        await newSemester.save();
        console.log('Semester created successfully.')
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading the file.');
    }
});

router.post("/fetchSemesters", isAuth, isTeacher, async function(req, res, next) {
    try {
        const semester = await Semester.find().sort({name: -1});
        res.send(JSON.stringify(semester));
    } catch(e) {
        console.log("Finding lessons error: ", e);
    }
});

// Route to display an individual file based on its ID
router.get('/lessons/:lessonId/files/:fileId', async (req, res) => {
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
module.exports = router;
