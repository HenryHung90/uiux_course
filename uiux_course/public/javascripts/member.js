let currentSemester;
let lessons;

/**
 * Common small modal
 */
const shareStuffModal = {
    modal: $("#shareStuffModal"),
    setData (mTitle="", mBody="", mFooter="") {
        this.modal.find(".modal-title").text(mTitle);
        this.modal.find(".modal-body").html(mBody);
        this.modal.find(".modal-footer").html(mFooter);
    },
    show: () => {
        let bsModal = bootstrap.Modal.getInstance($("#shareStuffModal"));
        if(!bsModal){bsModal = new bootstrap.Modal($("#shareStuffModal"))}
        bsModal.show();
    },
    customFunc: {},
    resetCustomFunc() {
        this.customFunc = {};
    },
    addCustomFunction(name, func) {
        if (typeof func === "function") {
            this.customFunc[name] = func;
        } else {
            console.error("Only functions can be added!");
        }
    },
    callCustomFunction(name) {
        if (this.customFunc[name]) {
            this.customFunc[name]();
        } else {
            console.error(`Function with name '${name}' does not exist!`);
        }
    },
}

$().ready(function() {
    // Error indicate
    let queryParams = (new URL(location.href).searchParams);
    if(queryParams.get("err")) {
        alert(queryParams.get("err"));
    }
    if(queryParams.get("msg")) {
        alert(queryParams.get("msg"));
    }

    updateSemesters();
});

function updateSemesters() {
    $.post("/course/fetchSemesters/stu")
        .done(async (data) => {
            $("#semesters ul").empty();
            let semesters = JSON.parse(data);
            semesters.forEach(semester => {
                let newSemester = `<li><a class="dropdown-item" href="#" id="${semester.id}" onclick="updateSemesterFields({name: ${semester.name}, id: ${semester.id}})">${semester.name}</a></li>`;
                $("#semesters ul").append(newSemester);
            });
            updateSemesterFields(semesters[0]);
            await fetchLessons();
            updateLessonBtnList();
            // Click 1st lesson
            if(lessons.length > 0) {
                $(`#${lessons[0]._id}Btn`).click();
            }
        })
        .fail((xhr, status, error) => {
            console.log("更新學期失敗： ", error);
        })
}

function updateSemesterFields(semester) {
    currentSemester = semester;
    $("#semester").text(currentSemester.name+" 學期");
}

async function fetchLessons() {
    await $.post("/course/fetchLessons", {semester: currentSemester.name})
        .done((data) => {
            lessons = JSON.parse(data);
        })
        .fail((xhr, status, error) => {
            alert("更新課程單元失敗");
            console.log("更新課程單元失敗： ", error);
        })
}

function updateLessonBtnList() {
    $("#lesson-name-list").empty();
    for(let i = 0; i < lessons.length; i++) {
        lesson = lessons[i];
        let newLesson = 
            `<button class="btn w-100 text-start p-2 border-bottom border-1 border-light-subtitle lesson-list" type="button" id="${lesson._id}Btn" onclick="showLessonData('${i}')">${lesson.name}</button>`;
        $("#lesson-name-list").append(newLesson);
    }
}

async function fetchPersonalSubmission() {
    try {
        let data = await $.post("course/lesson/getPersonalSubmissions");
        let rtnList = JSON.parse(data);
        return rtnList;
    } catch (error) {
        alert("取得繳交作業失敗");
        console.error("取得繳交作業失敗：", error);
        return []; // return an empty array if there's an error
    }
}

async function showLessonData(lessonIndex) {
    await fetchLessons();
    let submissions = await fetchPersonalSubmission();
    let lesson = lessons[lessonIndex];
    console.log("before: ", submissions);
    for(let i = 0; i < lesson.hws.length; i++) {
        lessonSub = submissions.find((ele) => 
            ele.hwId.toString() == lesson.hws[i]._id.toString());
        lesson.hws[i].submission = lessonSub || {submissions: [{
            isHandIn: '',
            studentId: '',
            studentName: '',
            handInData: {
                links: [{}],
                files: [{}]
            },
            category: { 
                name: '',
                catId: '',
            },
            feedback: '',
            score: '',
            analysis: {
                result: []
            }
        }]};
    }
    $(".lesson-list-chosen").removeClass("lesson-list-chosen");
    $(`#${lesson._id}Btn`).addClass("lesson-list-chosen");

    // Material
    $("#pills-material").empty();
    let newMat = `
        <ul>
            ${lesson.files.map(file => `
                <li>
                    <a href="course/lessons/${lesson._id}/files/${file._id}" target="_blank">${file.name}</a>
                </li>
            `).join('')}
        </ul>
        ${lesson.links.length?`<hr></hr><h6>參考連結</h6><ul>`:''}
            ${lesson.links.map(link => `
                <li>
                    <a href="${link.url}" target="_blank">${link.url}</a>
                </li>
            `).join('')}
        </ul>
    `;
    $("#pills-material").append(newMat);

    console.log(lessons);
    // Homework
    $("#homework-table tbody").empty();
    let newHome = `${lesson.hws.map((hw, index) => `
        <tr>
            <th>${index+1}</th>
            <td>${hw.name?hw.name:''}</td>
            <td>${hw.description?hw.description:''}</td>
            <td>${hw.src?hw.src.map(src => {`
                <a href="${src.path}" target="_blank">${src.name}</a>
            `}).join(''):''}</td>
            <td>${hw.attribute=="g" ? "團體" : "個人"}</td>
            <td>${hw.isRegular ? "例行作業" :
                    hw.isCatCustom ? 
                        hw.attribute=="p" ? `<button type="button" class="btn btn-outline-dark">自訂</button>`
                        : `<div class="btn-group">
                                <button type="button" class="btn btn-outline-dark">加入</button>
                                <button type="button" class="btn btn-outline-dark">新增</button>
                            </div>`
                     : `<button type="button" class="btn btn-outline-dark">加入</button>`
                }
            </td>
            <td>
                <ul class="my-1 p-0" style="list-style: none;">
                    ${hw.submission.submissions[0].handInData.files ? 
                    hw.submission.submissions[0].handInData.files.map(file => `
                        <li class="d-flex align-items-center">    
                            <button type="button" class="btn btn-danger me-1">-</button> 
                            <a href="/course/getHw/${hw._id}/${file._id}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/file.svg" alt=""></a>
                        </li>
                    `).join('') : ''}
                    ${hw.submission.submissions[0].handInData.links ? 
                    hw.submission.submissions[0].handInData.links.map(link => `
                        <li>    
                            <button type="button" class="btn btn-danger">-</button> 
                            <a href="${link.url}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/link.svg" alt=""></a>
                        </li>
                    `).join('') : ''}
                </ul>
                <button type="button" class="btn btn-outline-dark" onclick="showHandInHwModal('${hw.name}', '${hw._id}')">+</button>
            </td>
            <td> 
                ${hw.isAnalysis ? `
                    <div class="accordion">
                        <div class="accordion-item"> 
                            <h2 class="accordion-header"> 
                                <button class="fw-bold accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseStuId${hw.submission._id}" aria-expanded="false" aria-controls="collapseStuId">分析結果</button>
                            </h2>
                            <div class="accordion-collapse collapse" id="collapseStuId${hw.submission._id}">
                                <div class="accordion-body">
                                    ${hw.submission.submissions[0].analysis.result.length > 0 ?
                                        hw.submission.submissions[0].analysis.result.map(result => {`
                                            <strong>${result.title}</strong>
                                            <p>${result.content}</p>
                                            `}).join('') :
                                            `<p>暫無分析結果 😵‍💫</p>`
                                    }
                                </div>
                            </div>
                        </div>
                    </div>` :
                    "此作業無 AI 分析"}
            </td>
            <td>${hw.submission.submitStatus==1?hw.submission.submissions[0].feedback/** TODO course 改：將 score 根據送出狀態回傳 */:``}</td>
            <td>${hw.submission.submitStatus==1?hw.submission.submissions[0].score:``}</td>
        </tr>
    `).join('')}`;
    $("#homework-table tbody").append(newHome);
}

function showHandInHwModal(hwName="", hw_id="") {
    let modalBody = `
        <div class="mb-3" id="hwAddLink">
            <div class="form-label">
                <span class="me-3">上傳連結</span>
                <button class="btn btn-outline-dark" type="button" onclick="newMetLink('#hwAddLink')">加連結</button>
            </div>
            <label class="form-label" for="hw-files-add">上傳檔案（可按 shift 多選）</label>
            <input class="form-control mb-3" id="hw-files-add" type="file" multiple="">
        </div>
    `;
    let modalFooter = `
        <button type="button" id="submitHwBtn" class="btn btn-primary">繳交</button>
    `;
    shareStuffModal.resetCustomFunc();
    // Set submit func
    shareStuffModal.addCustomFunction("submitHomework", function () {
        let formData = new FormData();
        formData.append("semester", currentSemester.name);
        formData.append("name", $(".lesson-list-chosen").text());
        formData.append("hwId", hw_id);

        let links = [];
        $("input[name='l-link-add']").each(function () { //TODO: 存完要刪除所有同 name input
            if ($(this).val()) {
                links.push({ url: $(this).val() });
            }
        });
        formData.append("links", JSON.stringify(links));

        let files = $("#hw-files-add")[0].files;
        for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
        }

        $.ajax({
            url: "/course/lesson/submitHomework",
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                alert("提交成功！🤟🏻");
            },
            error: function (jqXHR, textStatus, errorThrown) {
                alert("提交失敗，請再試一次！💩");
            }
        })
    });
    shareStuffModal.setData(`繳交作業-${hwName}`, modalBody, modalFooter);
    $("#submitHwBtn").on("click", () => {shareStuffModal.callCustomFunction("submitHomework");});
    shareStuffModal.show();
}

// TODO to restructure into an Object------- start
function newMetLink(container) {
    let cTime = Date.now();
    let newLink = `
        <div class="d-flex mb-3" id="${cTime}">
            <button class="btn btn-danger me-2" type="button" onclick="removeMetLink(${cTime})">-</button>
            <input class="form-control" type="text" name="l-link-add" placeholder="請輸入連結">
        </div>
    `;
    $(container).append(newLink);
}

function removeMetLink(cTime) {
    let isDelete = confirm("確定要刪除教材連結？\n刪除後無法復原");
    if (isDelete) {
        $(`#${cTime}`).remove();
    }
}
// TODO to restructure----- end