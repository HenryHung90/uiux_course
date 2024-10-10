let currentSemester;
let lessons;

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

$().ready(function () {
    updateSemesters();

    $("#hwAttr").on("change", function () {
        if ($("#hwAttr").val() == "g") {
            $("#isCatReg").prop("checked", false);
            $("#catInputContainer").removeClass("d-none");
            $("#catContainer").removeClass("d-none");
            $("#handInIndividualGroup").removeClass("d-none");
        } else if ($("#hwAttr").val() == "p") {
            $("#handInIndividualGroup").addClass("d-none");
        }
    })
})

function addLesson() {
    let l_name = $("#l-name").val();
    let l_files = $("#l-files")[0].files;
    let l_links = [];

    if (!l_name) {
        alert("教學單元不應為空");
    } else {
        let formData = new FormData();
        // let homeworks = [];
        formData.append('name', l_name);
        // Extract data from homework table
        // $("#l-homeworks tbody tr").each(function() {
        //     if($(this).find("textarea").val()) {
        //         homeworks.push({
        //             id: this.id,
        //             description: $(this).find("textarea").val()
        //         })
        //     }
        // });
        // if(homeworks) {
        //     formData.append("hws", JSON.stringify(homeworks));
        // }
        formData.append('semester', currentSemester.name);

        // 添加文件到 formData 对象中
        for (let i = 0; i < l_files.length; i++) {
            formData.append('files', l_files[i]);
        }

        $("input[name='l-link']").each(function () {
            if ($(this).val()) {
                l_links.push({ url: $(this).val() });
            }
        });
        formData.append('links', JSON.stringify(l_links));

        $.ajax({
            url: "/course/addLesson",
            type: "POST",
            data: formData,
            processData: false,  // Not precess the data
            contentType: false,  // Not set the content type
            success: function (res) {
                if (res == "Created") {
                    $("#addLessonModal").modal("hide");
                    alert("新增成功！");
                    fetchLessons();
                }
            },
            error: function (xhr, status, error) {
                console.error("Error:", error);
            }
        });
    }
}

function toggleHwMatAddBtn(btn) {
    if (btn == "hw") {
        $("#addHwBtn").removeClass("d-none");
        $("#addMatBtn").addClass("d-none");
    } else {
        $("#addHwBtn").addClass("d-none");
        $("#addMatBtn").removeClass("d-none");
    }
}

function customCatToggle(status) {
    switch (status) {
        // Regular
        case "reg":
            if ($("#isCatReg").is(":checked")) {
                $("#hwAttr").val("p").change();
                $("#isCatCustom").prop("checked", false);
            } else if (!$("#isCatReg").is(":checked") && !$("#isCatCustom").is(":checked")) {
                $("#catInputContainer").removeClass("d-none");
                $("#catContainer").removeClass("d-none");
            }
            break;
        // Custom / Specify
        case "oth":
            if ($("#isCatCustom").is(":checked")) {
                $("#isCatReg").prop("checked", false);
                $("#catInputContainer").addClass("d-none");
                $("#catContainer").addClass("d-none");
            } else {
                $("#catInputContainer").removeClass("d-none");
                $("#catContainer").removeClass("d-none");
            }
            break;
    }
}

function addCat() {
    if ($.trim($("#catInput").val())) {
        let newCat = `
            <button class="btn btn-outline-danger m-2" type="button" name="cat-button" onclick="rmCat(this)">${$("#catInput").val()}</button>
        `;
        $("#catContainer").append(newCat);
        $("#catInput").val("");
    }
}

function rmCat(ele) {
    if (confirm("確定刪除嗎？")) {
        $(ele).remove();
    }
}

function addMat() {
    let formData = new FormData();
    formData.append("semester", currentSemester.name);
    formData.append("name", $(".lesson-list-chosen").text());
    let l_files = $("#l-files-add")[0].files;
    let l_links = [];
    let l_id = $(".lesson-list-chosen")[0].id;

    for (let i = 0; i < l_files.length; i++) {
        formData.append('files', l_files[i]);
    }
    $("input[name='l-link-add']").each(function () {
        if ($(this).val()) {
            l_links.push({ url: $(this).val() });
        }
    });
    formData.append('links', JSON.stringify(l_links));

    if (l_id.length) {
        l_id = l_id.substring(0, l_id.length - 3);
        formData.append('id', l_id);
    } else {
        alert("系統錯誤，請洽系統人員");
        return;
    }

    $.ajax({
        url: "/course/addMat",
        type: "POST",
        data: formData,
        processData: false,  // Not precess the data, prevent data convert to string
        contentType: false,  // Not set the content type, default: application/x-www-form-urlencoded
        success: function (res) {
            if (res == "Created") {
                $("#addMatModal").modal("hide");
                alert("新增成功！");
                fetchLessons();
            }
        },
        error: function (xhr, status, error) {
            alert("新增失敗！");
            console.error("Error:", error);
        }
    });
}

function deleteMat(lesson_id, mat_id, isFile) {
    if (confirm("確定是除教材？\n（刪除後無法復原）")) {
        const data = { lesson_id };
        if (isFile) {
            data.file_id = mat_id;
        } else {
            data.link_id = mat_id;
        }
        $.post("/course/deleteMat", data)
            .done((data) => {
                fetchLessons();
                alert("教材刪除成功！");
            })
            .fail((xhr, status, error) => {
                console.log("教材刪除失敗： " + error);
                alert("教材刪除失敗");
            })
    }
}

// function newHomework() {
//     let cTime = Date.now();
//     let tbLength = $("#l-homeworks tbody tr").length;
//     let newHw = `
//         <tr id="${cTime}">    
//             <td>
//                 <button class="btn btn-outline-danger" type="button" onclick="rmHomework(${cTime})">-</button>
//             </td>
//             <td>
//                 ${tbLength+1}
//             </td>
//             <td>
//                 <textarea class="form-control" name="hw-${cTime}" rows="1"></textarea>
//             </td>
//         </tr>
//     `;
//     $("#l-homeworks tbody").append(newHw);
// }

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

function addHomework() {
    let formData = new FormData();
    formData.append("semester", currentSemester.name);
    formData.append("name", $(".lesson-list-chosen").text());
    let files = $("#hw-files-add")[0].files;
    let links = [];
    let categories = [];
    let l_id = $(".lesson-list-chosen")[0].id;

    if (l_id.length) {
        l_id = l_id.substring(0, l_id.length - 3);
        formData.append('id', l_id);
    } else {
        alert("系統錯誤，請洽系統人員");
        return;
    }

    if (!$("#hwName").val()) {
        alert("請輸入作業名稱！");
    } else {
        // hwName
        formData.append("hwName", $("#hwName").val());

        // description
        formData.append("description", $("#hwDes").val());

        // files
        for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
        }

        // links
        $("input[name='l-link-add']").each(function () { //TODO: 存完要刪除所有同 name input
            if ($(this).val()) {
                links.push({ url: $(this).val() });
            }
        });
        formData.append("links", JSON.stringify(links));

        // attribute
        formData.append("attribute", $("#hwAttr").val());

        // isAnalysis
        formData.append("isAnalysis", $("#isAnalysis").prop("checked") ? true : false);

        // isHandInByIndividual
        formData.append("isHandInByIndividual", $("#isHandInByIndividual").prop("checked") ? true : false);

        // isRegular
        formData.append("isRegular", $("#isCatReg").prop("checked") ? true : false);

        // isCustom
        formData.append("isCatCustom", $("#isCatCustom").prop("checked") ? true : false);

        $("button[name='cat-button']").each(function () { //TODO: 存完要刪除所有同 name input
            categories.push({
                name: this.innerHTML
            })
        })
        formData.append("categories", JSON.stringify(categories));

        $.ajax({
            url: "/course/addHw",
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                alert("新增成功");
                showLessonData($(".lesson-list").index(".lesson-list-chosen"));
            },
            error: function (jqXHR/* XMLHttpRequest */, textStatus, errorThrown) {
                alert("新增失敗");
                showLessonData($(".lesson-list").index(".lesson-list-chosen"));
            }
        })
    }
}

function removeHomework(lesson_id, hw_id) {
    let isDelete = confirm("確定要刪除作業？\n刪除後無法復原");
    if (isDelete) {
        $.post("/course/rmHw", {
            lessonId: lesson_id,
            homeworkId: hw_id
        })
            .done((data) => {
                alert("刪除成功！");
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                alert("刪除失敗！");
            })
        let originHwList = $("#l-homeworks tbody tr");
        originHwList.each(function () {
            if (this.id == hw_id) {
                this.remove();
            }
        })

        // Reorder
        let currentHws = $("#l-homeworks tbody tr");
        currentHws.each(function (index) {
            $(this).find("td").eq(1).text(index + 1);
        })
    }
}

function showCorrectHomeworkModal(hw_id, hw_name, isAnalysis, attribute, isHandInByIndividual) {
    const correctingModalObject = new bootstrap.Modal("#correctingModal");
    let correctingModal = $("#correctingModal");
    //TODO Display loading

    // hide / show analysis column
    $("#anaTh").attr("style", `display: ${isAnalysis ? '' : 'none'};`);
    // Fetch hand ins and calculate hand in status
    $.post("/course/fetchHomework", { semester_id: currentSemester.id, hw_id, attribute })
        .done((data) => {
            let resData = JSON.parse(data);
            let submissions = resData.submissions;
            $("#submissionTable").attr("hwId", hw_id);
            //TODO Hide loading
            // Replace modal data
            $("#correctingModal .modal-title").text("批改作業-" + hw_name);
            let tbody = $("#submissionTable > tbody");
            tbody.empty();
            let handinNums = 0;
            if (attribute == 'p') {
                submissions.forEach((submission, index) => {
                    let isHandIn = submission.isHandIn;
                    if (isHandIn) { handinNums++; }
                    let newRow = `<tr class="border rounded">
                        <td id="${submission.studentId}">${index + 1}</td>
                        <td name="studentId">${submission.studentId}</td>
                        <td>${submission.studentName}</td>
                        <td> 
                            <ul class="m-0">
                                ${submission.handInData.files ? submission.handInData.files.map(file => `
                                    <li>    
                                        <a href="/course/getHw/${hw_id}/${file._id}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/file.svg" alt=""></a>
                                    </li>
                                `).join('') : ''}
                                ${submission.handInData.links ? submission.handInData.links.map(link => `
                                    <li>    
                                        <a href="${link.url}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/link.svg" alt=""></a>
                                    </li>
                                `).join('') : ''}
                            </ul>
                        </td>
                        <td>${submission.category.name ? submission.category.name : ''}</td>
                        <td><textarea class="form-control" id="textarea_stuId" name="feedback" rows="2">${isHandIn ? submission.feedback : '未繳交作業'}</textarea></td>
                        <td style="width: 10%"><input class="form-control" type="text" name="score" value="${isHandIn ? submission.score : 0}"></td>
                        <td style="display: ${isAnalysis ? '' : 'none'}"> 
                            <div class="accordion">
                                <div class="accordion-item"> 
                                    <h2 class="accordion-header"> 
                                        <button class="fw-bold accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseStuId${submission._id}" aria-expanded="false" aria-controls="collapseStuId">分析結果</button>
                                    </h2>
                                    <div class="accordion-collapse collapse" id="collapseStuId${submission._id}">
                                        <div class="accordion-body">
                                            ${submission.analysis.result.length > 0 ?
                            submission.analysis.result.map(result => {
                                `
                                                    <strong>${result.title}</strong>
                                                    <p>${result.content}</p>
                                                    `}).join('') :
                            `<p>暫無分析結果 😵‍💫</p>`}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>`
                    console.log(index, submission);
                    tbody.append(newRow);
                });
                $("#hangInProgress > .progress-bar")
                    .attr("style", `width: ${handinNums / submissions.length * 100}%`)
                    .text(`${handinNums} / ${submissions.length}`);
            } else {
                submissions = JSON.parse(data);
                if (isHandInByIndividual) {
                    let stuNum = 1;
                    submissions.forEach((groupSubmission) => {
                        groupSubmission.submissions.forEach((submission, index) => {
                            stuNum++;
                            let isHandIn = submission.isHandIn;
                            if (isHandIn) { handinNums++; }
                            let newRow = `<tr class="border rounded">
                                <td id="${submission.studentId}">${stuNum}</td>
                                <td name="studentId">${submission.studentId}</td>
                                <td>${submission.studentName}</td>
                                <td> 
                                    <ul class="m-0">
                                        ${submission.handInData.files ? submission.handInData.files.map(file => `
                                            <li>    
                                                <a href="course/getHw/${hw_id}/${file._id}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/file.svg" alt=""></a>
                                            </li>
                                        `).join('') : ''}
                                        ${submission.handInData.links ? submission.handInData.links.map(link => `
                                            <li>    
                                                <a href="${link.url}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/link.svg" alt=""></a>
                                            </li>
                                        `).join('') : ''}
                                    </ul>
                                </td>
                                ${index == 0 ? `<td rowspan="${groupSubmission.submissions.length}">${submission.category.name}</td>` : ``}
                                <td><textarea class="form-control" id="textarea_stuId" name="feedback" rows="2">${isHandIn ? `${submission.feedback}` : '未繳交作業'}</textarea></td>
                                <td style="width: 10%"><input class="form-control" type="text" name="score" value="${isHandIn ? `${submission.score}` : 0}"></td>
                                <td style="display: ${isAnalysis ? '' : 'none'}"> 
                                    <div class="accordion">
                                        <div class="accordion-item"> 
                                            <h2 class="accordion-header"> 
                                                <button class="fw-bold accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseStuId${submission._id}" aria-expanded="false" aria-controls="collapseStuId">分析結果</button>
                                            </h2>
                                            <div class="accordion-collapse collapse" id="collapseStuId${submission._id}">
                                                <div class="accordion-body">
                                                    ${submission.analysis.result.length > 0 ?
                                    submission.analysis.result.map(result => {
                                        `
                                                            <strong>${result.title}</strong>
                                                            <p>${result.content}</p>
                                                            `}).join('') :
                                    `<p>暫無分析結果 😵‍💫</p>`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>`
                            console.log(index, submission);
                            tbody.append(newRow);
                        });
                        tbody.append(`<tr><td colspan="8"></td><tr>`);
                    });
                    $("#hangInProgress > .progress-bar")
                        .attr("style", `width: ${handinNums / stuNum * 100}%`)
                        .text(`${handinNums} / ${stuNum}`);
                } else {
                    let stuNum = 0;
                    submissions.forEach((groupSubmission) => {
                        groupSubmission.submissions.forEach((submission, index) => {
                            stuNum++;
                            let isHandIn = submission.isHandIn;
                            if (isHandIn) { handinNums++; }
                            let newRow = `<tr class="border rounded">
                                <td id="${groupSubmission._id}">${index + 1}</td>
                                <td name="studentId">${submission.studentId}</td>
                                <td>${submission.studentName}</td>
                                ${index == 0 ? `
                                    <td rowspan="${groupSubmission.submissions.length}">
                                        <ul class="m-0">
                                            ${submission.handInData.files ? submission.handInData.files.map(file => `
                                                <li>    
                                                    <a href="course/getHw/${hw_id}/${file._id}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/file.svg" alt=""></a>
                                                </li>
                                            `).join('') : ''}
                                            ${submission.handInData.links ? submission.handInData.links.map(link => `
                                                <li>    
                                                    <a href="${link.url}" target="_blank" class="text-truncate d-inline-block" style="max-width: 200px;"><img src="./images/link.svg" alt=""></a>
                                                </li>
                                            `).join('') : ''}
                                        </ul>
                                    </td>`: ``}
                                ${index == 0 ? `<td rowspan="${groupSubmission.length}">${submission.category.name}</td>` : ``}
                                ${index == 0 ? `
                                    <td rowspan="${groupSubmission.submissions.length}">
                                        <textarea class="form-control" id="textarea_stuId" name="feedback" rows="2">${isHandIn ? `${submission.feedback}` : '未繳交作業'}</textarea>
                                    </td>`: ``}
                                <td style="width: 10%"><input class="form-control" type="text" name="score" value="${isHandIn ? `${submission.score}` : 0}"></td>
                                ${index == 0 ? `
                                    <td rowspan="${groupSubmission.submissions.length}">
                                        <td style="display: ${isAnalysis ? '' : 'none'}"> 
                                            <div class="accordion">
                                                <div class="accordion-item"> 
                                                    <h2 class="accordion-header"> 
                                                        <button class="fw-bold accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseStuId${submission._id}" aria-expanded="false" aria-controls="collapseStuId">分析結果</button>
                                                    </h2>
                                                    <div class="accordion-collapse collapse" id="collapseStuId${submission._id}">
                                                        <div class="accordion-body">
                                                            ${submission.analysis.result.length > 0 ?
                                        submission.analysis.result.map(result => {
                                            `
                                                                    <strong>${result.title}</strong>
                                                                    <p>${result.content}</p>
                                                                    `}).join('') :
                                        `<p>暫無分析結果 😵‍💫</p>`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </td>`: ``}
                            </tr>`
                            console.log(index, submission);
                            tbody.append(newRow);
                        });
                        tbody.append(`<tr><td colspan="8"></td><tr>`);
                    });
                    $("#hangInProgress > .progress-bar")
                        .attr("style", `width: ${handinNums / stuNum * 100}%`)
                        .text(`${handinNums} / ${stuNum}`);
                }
            }

            // console.log(resData.submissions);
            // console.log(resData.submissions.length);
            // TODO: res data display
            correctingModalObject.show();

            console.log(data);
        })
        .fail((xhr, status, error) => {
            alert("更新繳交作業失敗");
            console.log("更新繳交作業失敗： " + error);
        })
}

function showAiAnalysisModal() {
    // $.post("/course/lesson/get");

    let bsModal = bootstrap.Modal.getInstance($("#aiAnalysisModal"));
    if (!bsModal) { bsModal = new bootstrap.Modal($("#aiAnalysisModal")) }
    bsModal.show();
}

/**
 * 
 * @param {*} status 0=keep grade, 1=submit grade
 */
function submitGrade(status = 0) {
    if (status == 1) {
        if (!confirm("確認送出？\n送出後不能再修改，且學生會看到成績與評語！")) {
            return;
        }
    }
    let submissionTable = $("#submissionTable");
    let submissions = submissionTable.find("tbody tr");
    let data = [];
    let lastCat;
    lastData = {
        feedback: "",
        score: ""
    };

    submissions.each(function () {
        let row = $(this);
        if (row.find('td[name="studentId"]').text().trim() ||
            row.find('textarea[name="feedback"]').val() ||
            row.find('td[name="score"] input').val()
        ) {
            if (row.find('td').eq(0).attr('id').trim() != lastCat) {
                lastData.feedback = row.find('textarea[name="feedback"]').val() || "";
            }
            data.push({
                studentId: row.find('td[name="studentId"]').text().trim() || "",
                feedback: lastData.feedback,
                score: row.find('input[name="score"]').val() || ""
            });
            lastCat = row.find('td').eq(0).attr('id').trim();
        }
    });
    $.post("/course/lesson/submitGrade", {
        hwId: submissionTable.attr("hwId"),
        keepStatus: status,
        data: JSON.stringify(data)
    })
        .done((data) => {
            alert(`成績${status == 0 ? '暫存成功！' : '送出成功！'}`);
        })
        .fail((xhr, status, error) => {
            alert("儲存失敗！");
            console.log("儲存失敗： ", error);
        })
}

function fetchLessons() {
    $.post("/course/fetchLessons", { semester: currentSemester.name })
        .done((data) => {
            lessons = JSON.parse(data);
            $("#lesson-name-list").empty();
            for (let i = 0; i < lessons.length; i++) {
                let lesson = lessons[i];
                let newLesson =
                    `
                        <div class="d-flex">
                            <input class="btn w-100 text-start p-2 border-bottom border-1 border-light-subtitle lesson-list" type="text" id="${lesson._id}Btn" value="${lesson.name}" onclick="showLessonData('${i}')" readonly></input>
                            <button type="button" class="btn p-0" onclick="editLessonName('${lesson._id}')" id="${lesson._id}editLessonNameBtn"><img src="/images/edit.svg"></img></button>
                            <button type="button" class="btn p-0 d-none" onclick="saveEditedLessonName('${lesson._id}')" id="${lesson._id}saveEditedLessonNameBtn"><img src="/images/check.svg"></img></button>
                            <button type="button" class="btn p-0 d-none" onclick="cancelEditedLessonName('${lesson._id}')" id="${lesson._id}cancelEditedLessonNameBtn"><img src="/images/x.svg"></img></button>
                        </div>
                    `;
                // let newLesson = // TODO: id duplicate
                // `<tr>
                //     <th scope="row">${i+1}</th>
                //     <td id="${lesson._id}">${lesson.name}</td>
                //     <td id="${lesson._id}">
                //         <ul>
                //             ${lesson.files.map(file => `
                //                 <li>
                //                     <a href="course/lessons/${lesson._id}/files/${file._id}" target="_blank">${file.name}</a>
                //                 </li>
                //             `).join('')}
                //         </ul>
                //     </td>
                //     <td id="${lesson._id}">
                //         <ul>
                //             ${lesson.hws.map(hw => `
                //                 <li>
                //                     <p>${hw.description}</p>
                //                 </li>
                //             `).join('')}
                //         </ul>
                //     </td>
                //     <td> 
                //         <button class="btn btn-outline-secondary" id="btnUpdate${lesson._id}" type="button">編輯</button>
                //         <button class="btn btn-outline-secondary" id="btnRemove${lesson._id}" type="button" onclick='deleteLesson(${JSON.stringify(lesson)})'>刪除</button>
                //     </td>
                // </tr>` 
                $("#lesson-name-list").append(newLesson);
                // Click 1st lesson
                $(`#${lessons[0]._id}Btn`).click();
            }
        })
        .fail((xhr, status, error) => {
            alert("更新課程單元失敗");
            console.log("更新課程單元失敗： ", error);
        })
}

function editLessonName(lessonId) {
    let input = $(`#${lessonId}Btn`)
        .prop('readonly', false);
    input[0].focus();

    $(`#${lessonId}saveEditedLessonNameBtn`).removeClass("d-none");
    $(`#${lessonId}cancelEditedLessonNameBtn`).removeClass("d-none");
    $(`#${lessonId}editLessonNameBtn`).addClass("d-none");
}

function saveEditedLessonName(lessonId) {
    let input = $(`#${lessonId}Btn`);
    $.post("/course/updateLessonName", { lessonId, title: input.val() })
        .done((data) => {
            input
                .val(JSON.parse(data).savedTitle)
                .prop('readonly', true);
            input[0].blur();

            $(`#${lessonId}saveEditedLessonNameBtn`).addClass("d-none");
            $(`#${lessonId}cancelEditedLessonNameBtn`).addClass("d-none");
            $(`#${lessonId}editLessonNameBtn`).removeClass("d-none");

            alert("單元名稱更新成功！👍🏻");
        })
        .fail((xhr, status, error) => {
            alert("單元名稱更新失敗！👎🏻");
        });
}

function cancelEditedLessonName(lessonId) {
    let input = $(`#${lessonId}Btn`)
        .prop('readonly', true);
    input[0].blur();

    $(`#${lessonId}saveEditedLessonNameBtn`).addClass("d-none");
    $(`#${lessonId}cancelEditedLessonNameBtn`).addClass("d-none");
    $(`#${lessonId}editLessonNameBtn`).removeClass("d-none");
}

function editMatName(matId) {
    $(`#${matId}link`).hide();

    $(`#${matId}matNameInput`).removeClass("d-none");
    $(`#${matId}saveEditedMatNameBtn`).removeClass("d-none");
    $(`#${matId}cancelEditedLessonNameBtn`).removeClass("d-none");
    $(`#${matId}editMatNameBtn`).addClass("d-none");
}
function saveEditedMatName(lessonId, matId) {
    let link = $(`#${matId}link`);
    
    $(`#${matId}matNameInput`).addClass("d-none");
    $(`#${matId}saveEditedMatNameBtn`).addClass("d-none");
    $(`#${matId}cancelEditedLessonNameBtn`).addClass("d-none");
    $(`#${matId}editMatNameBtn`).removeClass("d-none");

    $.post("/course/updateMatName", { lessonId, matId, title: $(`#${matId}matNameInput`).val() })
        .done((data) => {
            link.text(JSON.parse(data).savedTitle);

            $(`#${matId}matNameInput`).addClass("d-none");
            $(`#${matId}saveEditedMatNameBtn`).addClass("d-none");
            $(`#${matId}cancelEditedLessonNameBtn`).addClass("d-none");
            $(`#${matId}editMatNameBtn`).removeClass("d-none");

            link.show();

            alert("教材名稱更新成功！👍🏻");
        })
        .fail((xhr, status, error) => {
            alert("教材名稱更新失敗！👎🏻");
        });
}
function cancelEditedMatName(matId) {
    let link = $(`#${matId}link`).show();

    $(`#${matId}matNameInput`).addClass("d-none");
    $(`#${matId}saveEditedMatNameBtn`).addClass("d-none");
    $(`#${matId}cancelEditedLessonNameBtn`).addClass("d-none");
    $(`#${matId}editMatNameBtn`).removeClass("d-none");
}

function showLessonData(lessonIndex) {
    let lesson = lessons[lessonIndex];
    $(".lesson-list-chosen").removeClass("lesson-list-chosen");
    $(`#${lesson._id}Btn`).addClass("lesson-list-chosen");

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
            <td>${hw.attribute ? (hw.attribute == "p" ? '個人' : '團體') : ''}</td>
            <td>${hw.isRegular ? '例行作業' :
            `<button class="bg-transparent border-0 p-0 text-decoration-underline" onclick="showGroupListModal('${lesson._id}', '${hw._id}')">${hw.isCatCustom ? '自訂主題' : '指定主題'}</button>`}
            </td>
            <td>
                ${hw.uploaded ? hw.uploaded.map(up => {
                `
                    <button type="button" class="btn btn-danger">-</button>
                    <a href="${up.path}" target="_blank">${up.name}</a>
                `}).join('') : ''}
                <button type="button" class="btn btn-outline-dark">修改</button>
                <button type="button" class="btn btn-outline-danger" onclick="removeHomework('${lesson._id}', '${hw._id}')">刪除</button>
                <button type="button" class="btn btn-outline-primary" onclick="showCorrectHomeworkModal('${hw._id}', '${hw.name}', ${hw.isAnalysis}, '${hw.attribute}', ${hw.isHandInByIndividual})">批改</button>
                ${hw.isAnalysis ? `<button type="button" class="btn btn-outline-success" onclick="showAiAnalysisModal()">AI 分析</button>` : ``}
            </td>
        </tr>
    `).join('')}`;
    $("#homework-table tbody").append(newHome);

    // Material
    $("#pills-material").empty();
    let newMat = `
        <h6>教材檔</h6>
        <ul class="m-0 p-0" style="list-style-type: none;">
            ${lesson.files.map(file => `
                <li>
                    <button class="btn btn-outline-danger m-1" onclick="deleteMat('${lesson._id}', '${file._id}', true)">-</button>
                    <a href="course/${lesson._id}/${file._id}" id="${file._id}link" target="_blank">${file.name}</a>
                    <div class="d-inline-block">
                        <div class="input-group">
                            <input class="form-control d-none" id="${file._id}matNameInput" type="text" value="${file.name}">
                            <button type="button" class="btn btn-outline-secondary p-0 d-none" onclick="saveEditedMatName('${lesson._id}', '${file._id}')" id="${file._id}saveEditedMatNameBtn"><img src="/images/check.svg"></button>
                            <button type="button" class="btn btn-outline-secondary p-0 d-none" onclick="cancelEditedMatName('${file._id}')" id="${file._id}cancelEditedLessonNameBtn"><img src="/images/x.svg"></button>
                        </div>
                    </div>
                    <button class="btn" id="${file._id}editMatNameBtn" onclick="editMatName('${file._id}')"><img src="/images/edit.svg"></button>
                </li>
            `).join('')}
        </ul>
        ${lesson.links.length ? `<hr></hr><h6>參考連結</h6><ul class="m-0 p-0" style="list-style-type: none;">` : ''}
            ${lesson.links.map(link => `
                <li>
                    <button class="btn btn-outline-danger m-1" onclick="deleteMat('${lesson._id}', '${link._id}', false)">-</button>
                    <a href="${link.url}" target="_blank">${link.url}</a>
                </li>
            `).join('')}
        </ul>
    `;
    $("#pills-material").append(newMat);
}
function showGroupListModal(lesson_id, hw_id) {
    // Req group list in the hw
    $.post("/course/lesson/getGroupList", { lesson_id, hw_id })
        .done((data) => {
            // TODO 顯示主題其他情境 // 8/31 待釐清，目前初步想法：只要有主題的，不分個人還團體，都可以顯示加入，
            //然後沒主題的本來就不能點，不會影響，所以暫不分情境，皆為可點、可分享的 card
            data = JSON.parse(data);
            $("#groupListModal .modal-title").text(`${data.title}`);
            let row = $("#groupListModal .row").empty();
            data.categories.forEach((category) => {
                let newCat = `
                    <div class="col-sm-4 col-6 mb-2">
                        <div class="card">
                            <div class="card-header d-flex">
                                <h6 class="me-3 my-auto">${category.name}</h6>
                                <button class="btn btn-outline-dark" type="button" onclick="shareGroupCode('${category._id}', '${category.name}')">加入代碼</button>
                            </div>
                            <div class="card-body"> 
                                ${category.member.map(mem => `
                                    <p class="card-title">${mem.studentID} ${mem.studentName}</p>
                                    `).join('')}
                            </div>
                        </div>
                    </div>
                `;
                row.append(newCat);
            })

        })
        .fail((xhr, status, err) => {
            alert("請求分組清單失敗，請洽管理員😣");
            console.log(err);
        })
    new bootstrap.Modal("#groupListModal").show();
}

function shareGroupCode(gId, catName) {
    let groupListModal = bootstrap.Modal.getInstance($("#groupListModal"));
    let shareStuffModal = bootstrap.Modal.getInstance($("#shareStuffModal"));

    $("#shareStuffModal .modal-body").empty();
    $("#semesterCode").text(currentSemester.id);
    let newModalBody = `
    <div class="mb-3">
    <label class="form-label light">主題代碼</label>
    <h2>${gId}</h2>
    </div>
    `;
    $("#shareStuffModal .modal-title").text(`加入 - ${catName}`);
    $("#shareStuffModal .modal-header button")
        .attr({
            "data-bs-dismiss": "",
            "aria-label": ""
        })
        .on("click", () => rtnGroupListModal());
    $("#shareStuffModal .modal-body").append(newModalBody);

    if (!groupListModal) {
        groupListModal = new bootstrap.Modal($("#groupListModal"));
    }
    if (!shareStuffModal) {
        shareStuffModal = new bootstrap.Modal($("#shareStuffModal"));
    }
    groupListModal.hide();
    shareStuffModal.show();
}

function rtnGroupListModal() {
    let groupListModal = bootstrap.Modal.getInstance($("#groupListModal"));
    let shareStuffModal = bootstrap.Modal.getInstance($("#shareStuffModal"));

    if (!groupListModal) {
        groupListModal = new bootstrap.Modal(document.querySelector("#groupListModal"));
    }
    if (!shareStuffModal) {
        shareStuffModal = new bootstrap.Modal(document.querySelector("#shareStuffModal"));
    }
    shareStuffModal.hide();
    groupListModal.show();
}

function addSemester() {
    let newSemester = $("#semesterInput").val();
    if (!newSemester) { alert("學期不能為空"); }
    else {
        $.post("/course/addSemester", { name: newSemester })
            .done((data) => {
                alert("新增學期成功！");
                updateSemesters();
            })
            .fail((xhr, status, error) => {
                alert("新增學期失敗");
                console.log("新增學期失敗： ", error);
            })
    }
}

function updateSemesters() {
    $.post("/course/fetchSemesters")
        .done((data) => {
            $("#semesters ul").empty();
            let semesters = JSON.parse(data);
            semesters.forEach(semester => {
                let newSemester = ` <li><a class="dropdown-item" href="#" id="${semester.id}" onclick="updateSemesterFields({name: '${semester.name}', id: '${semester.id}'})">${semester.name}</a></li>`;
                $("#semesters ul").append(newSemester);
            });
            updateSemesterFields(semesters[0]);
        })
        .fail((xhr, status, error) => {
            console.log("更新學期失敗： ", error);
        })
}

function updateSemesterFields(semester) {
    currentSemester = semester;
    $("#semester").text(currentSemester.name + " 學期");
    fetchLessons();
}

function shareSemesterCode() {
    $("#shareStuffModal .modal-header button")
        .attr({
            "data-bs-dismiss": 'modal',
            "aria-label": 'Close'
        })
        .off("click");

    $("#shareStuffModal .modal-body").empty();
    $("#semesterCode").text(currentSemester.id);
    let newModalBody = `
        <div class="mb-3">
            <label class="form-label light">學期代碼</label>
            <h2>${currentSemester.id}</h2>
        </div>
    `;
    $("#shareStuffModal .modal-header h1").text('分享學期');
    $("#shareStuffModal .modal-body").append(newModalBody);

    new bootstrap.Modal("#shareStuffModal").show();
}

function deleteLesson(lesson) {
    let confirm_ans = confirm(`確定要刪除單元：${lesson.name}嗎？\n（刪除後教材、作業皆不會保留）`);
    if (confirm_ans) {
        $.post("/course/deleteLesson", { lessonId: lesson._id })
            .done((data) => {
                alert("單元刪除成功！");
                fetchLessons();
            })
            .fail((xhr, status, error) => {
                console.log(`${xhr.responseText} ${error}`)
                alert(`${xhr.responseText}`);
                fetchLessons();
            })
    }
}