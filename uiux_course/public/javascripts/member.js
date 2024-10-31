let currentSemester;
let lessons;

/**
 * Common small modal
 */
const shareStuffModal = {
    modal: $("#shareStuffModal"),
    setData(mTitle = "", mBody = "", mFooter = "") {
        this.modal.find(".modal-title").text(mTitle);
        this.modal.find(".modal-body").html(mBody);
        this.modal.find(".modal-footer").html(mFooter);
    },
    show: () => {
        let bsModal = bootstrap.Modal.getInstance($("#shareStuffModal"));
        if (!bsModal) { bsModal = new bootstrap.Modal($("#shareStuffModal")) }
        bsModal.show();
    },
    hide: () => {
        let bsModal = bootstrap.Modal.getInstance($("#shareStuffModal"));
        if (!bsModal) { bsModal = new bootstrap.Modal($("#shareStuffModal")) }
        bsModal.hide();
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

/**
 * Form submit util
 */
const formUtil = {
    /** Create a form and send get request */
    get(actionUrl, params) {
        // Create a form element
        const form = document.createElement("form");
        form.method = "GET"; // Set method to GET
        form.action = actionUrl; // Set the URL to which the form will be submitted

        // Dynamically create input elements for each parameter
        for (const key in params) {
            if (params.hasOwnProperty(key)) {
                const input = document.createElement("input");
                input.type = "hidden"; // Use hidden input fields to store parameters
                input.name = key; // Set the name of the input (parameter name)
                input.value = params[key]; // Set the value of the input (parameter value)
                form.appendChild(input); // Add the input to the form
            }
        }

        // Append the form to the body (not displayed to the user)
        document.body.appendChild(form);

        // Submit the form
        form.submit();
    }
}

$().ready(function () {
    updateSemesters();
});

function updateSemesters() {
    $.post("/course/fetchSemesters/stu")
        .done(async (data) => {
            $("#semesters ul").empty();
            let semesters = JSON.parse(data);
            semesters.forEach(semester => {
                let newSemester = `<li><a class="dropdown-item" href="#" id="${semester.id}" onclick="updateSemesterFields({name: '${semester.name}', id: '${semester.id}'})">${semester.name}</a></li>`;
                $("#semesters ul").append(newSemester);
            });
            updateSemesterFields(semesters[0]);
            await fetchLessons();
            updateLessonBtnList();
            // Click 1st lesson
            if (lessons.length > 0) {
                $(`#${lessons[0]._id}Btn`).click();
            }
        })
        .fail((xhr, status, error) => {
            console.log(`更新學期失敗：${xhr.responseText}`);
            alert(`更新學期失敗\n\n錯誤訊息：${xhr.responseText}`);
        })
}

function updateSemesterFields(semester) {
    currentSemester = semester;
    $("#semester").text(currentSemester.name + " 學期");
}

async function fetchLessons() {
    await $.post("/course/fetchLessons", { semester: currentSemester.name })
        .done((data) => {
            lessons = JSON.parse(data);
        })
        .fail((xhr, status, error) => {
            console.log(`更新課程單元失敗：${xhr.responseText}`);
            alert(`更新課程單元失敗\n\n錯誤訊息：${xhr.responseText}`);
        })
}

function updateLessonBtnList() {
    $("#lesson-name-list").empty();
    for (let i = 0; i < lessons.length; i++) {
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
        console.log(`取得繳交作業失敗：${xhr.responseText}`);
        alert(`取得繳交作業失敗\n\n錯誤訊息：${xhr.responseText}`);
        return []; // return an empty array if there's an error
    }
}

async function showLessonData(lessonIndex) {
    await fetchLessons();
    let submissionData = await fetchPersonalSubmission();
    let submissions = submissionData.submissions;
    let studentId = submissionData.studentId;
    let lesson = lessons[lessonIndex];
    for (let i = 0; i < lesson.hws.length; i++) {
        // 已繳交作業
        let lessonSub;
        let categoryWithStudent;
        if (submissions) {
            lessonSub = submissions.find((ele) =>
                ele.hwId.toString() == lesson.hws[i]._id.toString());
            categoryWithStudent = lesson.hws[i].categories.find(category =>
                category.member.some(member => member.studentID === studentId)
            );
        }

        lesson.hws[i].submission = lessonSub || {
            isHandIn: '',
            studentId: '',
            studentName: '',
            handInData: {
                links: [],
                files: []
            },
            category: '',
            feedback: '',
            score: '',
            analysis: {
                result: []
            }
        };
        // For indicate and save cat while upload hw
        lesson.hws[i].submission.category = categoryWithStudent ?
            {
                name: categoryWithStudent.name,
                catId: categoryWithStudent._id,
                member: categoryWithStudent.member
            } : {
                name: '',
                catId: '',
                member: []
            };
    }
    $(".lesson-list-chosen").removeClass("lesson-list-chosen");
    $(`#${lesson._id}Btn`).addClass("lesson-list-chosen");

    // Material
    $("#pills-material").empty();
    let newMat = `
        <ul>
            ${lesson.files.map(file => `
                <li>
                    <a href="course/${lesson._id}/${file._id}" target="_blank">${file.name}</a>
                </li>
            `).join('')}
        </ul>
        ${lesson.links.length ? `<hr></hr><h6>參考連結</h6><ul>` : ''}
            ${lesson.links.map(link => `
                <li>
                    <a href="${link.url}" target="_blank">${link.url}</a>
                </li>
            `).join('')}
        </ul>
    `;
    $("#pills-material").append(newMat);

    // Homework
    $("#homework-table tbody").empty();
    let newHome = `${lesson.hws.map((hw, index) => `
        <tr>
            <th>${index + 1}</th>
            <td>${hw.name ? hw.name : ''}</td>
            <td>${hw.description ? hw.description : ''}</td>
            <td>
                <ul class="m-0">
                    ${hw.files ? hw.files.map(file => `
                        <li>    
                            <a href="course/${lesson._id}/${hw._id}/${file._id}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;">${file.name}</a>
                        </li>
                    `).join('') : ''}
                    ${hw.links ? hw.links.map(link => `
                        <li>    
                            <a href="${link.url}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;">${link.url}</a>
                        </li>
                    `).join('') : ''}
                </ul>
            </td>
            <td>${hw.src ? hw.src.map(src => {
        `
                <a href="${src.path}" target="_blank">${src.name}</a>
            `}).join('') : ''}</td>
            <td>${hw.attribute == "g" ? "團體" : "個人"}</td>
            <td>${hw.isRegular ? "例行作業" :
            hw.submission.category.catId ?
                hw.attribute == "p" ? `<button type="button" class="btn btn-outline-dark" onclick="category.showPersonalCat('${hw.submission.category.name}')">組別（主題）</button>`
                    : `<button type="button" class="btn btn-outline-dark" onclick="category.showGroupCat('${hw.submission.category.name}', 
                        '${hw.submission.category.catId}', '${JSON.stringify(hw.submission.category.member).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">組別（主題）</button>`
                : hw.isCatCustom ?
                    hw.attribute == "p" ? `<button type="button" class="btn btn-outline-dark" onclick="category.createCat('${lesson._id}', '${hw._id}', ${lessonIndex})">自訂</button>`
                        : `<div class="btn-group">
                            <button type="button" class="btn btn-outline-dark" onclick="category.joinCat('${hw._id}')">加入</button>
                            <button type="button" class="btn btn-outline-dark" onclick="category.createCat('${lesson._id}', '${hw._id}', ${lessonIndex})">新增</button>
                        </div>`
                    : `<button type="button" class="btn btn-outline-dark" onclick="category.joinCat('${hw._id}')">加入</button>`
        }
            </td>
            <td>
                <ul class="my-1 p-0" style="list-style: none;">
                    ${hw.submission.handInData.files ?
            hw.submission.handInData.files.map(file => `
                        <li class="d-flex align-items-center">    
                            <button type="button" class="btn btn-danger me-1">-</button> 
                            <a href="/course/getHw/${hw._id}/${file._id}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/file.svg" alt=""></a>
                        </li>
                    `).join('') : ''}
                    ${hw.submission.handInData.links ?
            hw.submission.handInData.links.map(link => `
                        <li>    
                            <button type="button" class="btn btn-danger">-</button> 
                            <a href="${link.url}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/link.svg" alt=""></a>
                        </li>
                    `).join('') : ''}
                </ul>
                <button type="button" class="btn btn-outline-dark" onclick="showHandInHwModal('${hw.name}', '${hw._id}', '${hw.submission.category.name}', '${hw.submission.category.catId}')">+</button>
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
                                    ${hw.submission.analysis.result.length > 0 ?
                hw.submission.analysis.result.map(result => `
                                            <strong>${result.title}</strong>
                                            <p>${result.content.map(content =>
                    `#${content}`).join(' ')}</p>
                                            `).join('') :
                `<p>暫無分析結果 😵‍💫</p>`
            }
                                    <button type="button" class="btn btn-outline-dark" onclick="analyzeHw('${hw._id}', '${hw.submission._id}')">（重新）分析</button>
                                </div>
                            </div>
                        </div>
                    </div>` :
            "此作業無 AI 分析"}
            </td>
            <td>${hw.submission.submitStatus == 1 ? hw.submission.feedback/** TODO course 改：將 score 根據送出狀態回傳 */ : ``}</td>
            <td>${hw.submission.submitStatus == 1 ? hw.submission.score : ``}</td>
        </tr>
    `).join('')}`;
    $("#homework-table tbody").append(newHome);
}

const category = {
    showPersonalCat(catName) {
        // TODO 團體完後，再回來改
        let modalBody = `
            <div class="mb-3">
                <label class="form-label" for="catId">主題名稱</label>
                <!-- TODO 編輯按鈕 -->
                <input class="form-control mb-3" id="catId" type="text" value="${catName}">
            </div>
        `;
        shareStuffModal.resetCustomFunc();
        shareStuffModal.setData(`個人主題`, modalBody);
        shareStuffModal.show();
    },
    showGroupCat(catName, catId, catMember = "") {
        let catMemberArrObj = JSON.parse(catMember);
        catMemberArrObj.map((catMem, index) => {
            console.log(index + 1);
            console.log(catMem);
            console.log(catMem.studentID);
            console.log(catMem.studentName);

        });
        let modalBody = `
            <div class="mb-3">
                <label class="form-label" for="catId">主題名稱</label>
                <!-- TODO 編輯按鈕 -->
                <input class="form-control mb-3" id="catId" type="text" value="${catName}">
            </div>
            <ul class="nav nav-pills mb-3" id="pills-tab" role="tablist">
                <li class="nav-item me-3" role="presentation">
                    <button class="nav-link active" id="pills-teamMem-tab" data-bs-toggle="pill" data-bs-target="#pills-teamMem" type="button" role="tab" aria-controls="pills-teamMem" aria-selected="true">組員</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="pills-inviteGroup-tab" data-bs-toggle="pill" data-bs-target="#pills-inviteGroup" type="button" role="tab" aria-controls="pills-inviteGroup" aria-selected="false" tabindex="-1">邀請</button>
                </li>
            </ul>
            <div class="tab-content" id="pills-tabContent">
                <div class="tab-pane fade show active" id="pills-teamMem" role="tabpanel" aria-labelledby="pills-teamMem-tab" tabindex="0">
                    <table class="table">
                        <thead>
                            <th>#</th>
                            <th>學號</th>
                            <th>姓名</th>
                        </thead>
                        <tbody>
                            ${catMemberArrObj.map((catMem, index) => {
            return `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${catMem.studentID}</td>
                                    <td>${catMem.studentName}</td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="tab-pane fade" id="pills-inviteGroup" role="tabpanel" aria-labelledby="pills-inviteGroup-tab" tabindex="0">
                    <div class="mb-3">
                        <label class="form-label light">加入代碼</label>
                        <h2>${catId}</h2>
                    </div>
                </div>
            </div>
            `;
        shareStuffModal.resetCustomFunc();
        shareStuffModal.setData(`團體組別`, modalBody);
        shareStuffModal.show();
    },
    createCat(lessonId = "", hwId = "", lessonIndex = 0) {
        let modalBody = `
            <div class="mb-3">
                <label class="form-label" for="catName">主題名稱</label>
                <input class="form-control mb-3" id="catName" type="text">
            </div>
        `;
        let modalFooter = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss='modal'>取消</button>
            <button type="button" id="createCatBtn" class="btn btn-primary">新增</button>
        `;
        shareStuffModal.resetCustomFunc();
        shareStuffModal.addCustomFunction("createCat", function () {
            let catName = $("#catName").val();
            if (!catName) {
                alert("請輸入主題代碼！😡");
                return;
            }
            $.post("/course/createCat", {
                lessonId,
                hwId,
                catName
            })
                .done((data) => {
                    console.log("done");
                    alert("新增成功！");
                    showLessonData(lessonIndex);
                    shareStuffModal.hide();
                })
                .fail((xhr, status, error) => {
                    console.log(`新增失敗！：${xhr.responseText}`);
                    alert(`新增失敗！\n\n錯誤訊息：${xhr.responseText}`);
                })

        });
        shareStuffModal.setData(`新增主題`, modalBody, modalFooter);
        $("#createCatBtn").on("click", () => { shareStuffModal.callCustomFunction("createCat"); });
        shareStuffModal.show();
    },
    joinCat(hwId) {
        let modalBody = `
            <div class="mb-3">
                <label class="form-label" for="catId">組別（主題）代碼</label>
                <input class="form-control mb-3" id="catId" type="text">
            </div>
        `;
        let modalFooter = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss='modal'>取消</button>
            <button type="button" id="joinCatBtn" class="btn btn-primary">加入</button>
        `;
        shareStuffModal.resetCustomFunc();
        // Set submit func
        shareStuffModal.addCustomFunction("joinCat", function () {
            let catId = $("#catId").val();
            if (!catId) {
                alert("請輸入主題代碼！😡");
                return;
            }

            formUtil.get("/course/joinCategory", {
                semester: currentSemester.name,
                lessonId: $(".lesson-list-chosen").attr("id").replace("Btn", ""),
                hwId,
                catId
            });
        })
        shareStuffModal.setData(`加入主題`, modalBody, modalFooter);
        $("#joinCatBtn").on("click", () => { shareStuffModal.callCustomFunction("joinCat"); });
        shareStuffModal.show();
    },
}

function showHandInHwModal(hwName = "", hw_id = "", catName = "", catId = "") {
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
        formData.append("catName", catName);
        formData.append("catId", catId);

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
                console.log(`作業提交失敗：${jqXHR.responseText}`);
                alert(`提交失敗，請再試一次！💩\n\n錯誤訊息：${jqXHR.responseText}`);
            }
        })
    });
    shareStuffModal.setData(`繳交作業-${hwName}`, modalBody, modalFooter);
    $("#submitHwBtn").on("click", () => { shareStuffModal.callCustomFunction("submitHomework"); });
    shareStuffModal.show();
}

function analyzeHw(hwId, submissionId) {
    $.post("/course/aiAnalyze", { anaType: "keyWords", hwId, submissionId })
        .done((data) => {
            console.log(data);
        })
        .fail((xhr, status, error) => {
            console.log(`AI 分析失敗：${xhr.responseText}`);
            alert(`AI 分析失敗\n\n錯誤訊息：${xhr.responseText}`);
        })
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