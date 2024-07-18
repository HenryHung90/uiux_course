let currentSemester;
let lessons;

$().ready(function() {
    updateSemesters();
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

        $("input[name='l-link']").each(function() {
            if($(this).val()){
                l_links.push({url: $(this).val()});
            }
        });
        formData.append('links', JSON.stringify(l_links));

        $.ajax({
            url: "/course/addLesson",
            type: "POST",
            data: formData,
            processData: false,  // Not precess the data
            contentType: false,  // Not set the content type
            success: function(res) {
                if (res == "Created") {
                    $("#addLessonModal").modal("hide");
                    alert("新增成功！");
                    fetchLessons();
                }
            },
            error: function(xhr, status, error) {
                console.error("Error:", error);
            }
        });
    }
}

function toggleHwMatAddBtn(btn) {
    if(btn == "hw") {
        $("#addHwBtn").removeClass("d-none");
        $("#addMatBtn").addClass("d-none");
    } else {
        $("#addHwBtn").addClass("d-none");
        $("#addMatBtn").removeClass("d-none");
    }
}

function addMat() {
    let formData = new FormData();
    let l_files = $("#l-files-add")[0].files;
    let l_links = [];
    let l_id = $(".lesson-list-chosen")[0].id;

    for (let i = 0; i < l_files.length; i++) {
        formData.append('files', l_files[i]);
    }
    $("input[name='l-link-add']").each(function() {
        if($(this).val()){
            l_links.push({url: $(this).val()});
        }
    });
    formData.append('links', JSON.stringify(l_links));
    
    if(l_id.length) {
        l_id = l_id.substring(0, l_id.length-3);
        formData.append('id', l_id);
    } else {
        alert("系統錯誤，請洽系統人員");
        return;
    }

    $.ajax({
        url: "/course/addMat",
        type: "POST",
        data: formData,
        processData: false,  // Not precess the data
        contentType: false,  // Not set the content type
        success: function(res) {
            if (res == "Created") {
                $("#addMatModal").modal("hide");
                alert("新增成功！");
                fetchLessons();
            }
        },
        error: function(xhr, status, error) {
            alert("新增失敗！");
            console.error("Error:", error);
        }
    });
}

function deleteMat(lesson_id, mat_id, isFile) {
    if(confirm("確定是除教材？\n（刪除後無法復原）")) {
        const data = { lesson_id };
        if(isFile) {
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
                console.log("教材刪除失敗： "+error);
                alert("教材刪除失敗");
            })
    }
}

function newHomework() {
    let cTime = Date.now();
    let tbLength = $("#l-homeworks tbody tr").length;
    let newHw = `
        <tr id="${cTime}">    
            <td>
                <button class="btn btn-outline-danger" type="button" onclick="rmHomework(${cTime})">-</button>
            </td>
            <td>
                ${tbLength+1}
            </td>
            <td>
                <textarea class="form-control" name="hw-${cTime}" rows="1"></textarea>
            </td>
        </tr>
    `;
    $("#l-homeworks tbody").append(newHw);
}

function newMetLink(modal) {
    let cTime = Date.now();
    let newLink = `
        <div class="d-flex mb-3" id="${cTime}">
            <button class="btn btn-danger me-2" type="button" onclick="removeMetLink(${cTime})">-</button>
            <input class="form-control" type="text" name="l-link-add" placeholder="請輸入連結">
        </div>
    `;
    $(`#${modal} .modal-body`).append(newLink);
}

function removeMetLink(cTime) {
    let isDelete = confirm("確定要刪除教材連結？\n刪除後無法復原");
    if(isDelete) {
        $(`#${cTime}`).remove();
    }
}

function rmHomework(hw_id) {
    let isDelete = confirm("確定要刪除作業？\n刪除後無法復原");
    if(isDelete) {
        let originHwList = $("#l-homeworks tbody tr");
        originHwList.each(function() {
            if(this.id == hw_id) {
                this.remove();
            }
        })

        // Reorder
        let currentHws = $("#l-homeworks tbody tr");
        currentHws.each(function(index) {
            $(this).find("td").eq(1).text(index+1);
        })
    } 
}

function fetchLessons() {
    $.post("/course/fetchLessons", {semester: currentSemester.name})
        .done((data) => {
            lessons = JSON.parse(data);
            $("#lesson-name-list").empty();
            for(let i = 0; i < lessons.length; i++) {
                let lesson = lessons[i];
                let newLesson = 
                    `<button class="btn w-100 text-start p-2 border-bottom border-1 border-light-subtitle lesson-list" type="button" id="${lesson._id}Btn" onclick="showLessonData('${i}')">${lesson.name}</button>`;
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

function showLessonData(lessonIndex) {
    let lesson = lessons[lessonIndex];
    $(".lesson-list-chosen").removeClass("lesson-list-chosen");
    $(`#${lesson._id}Btn`).addClass("lesson-list-chosen");

    // Material
    $("#pills-material").empty();
    let newMat = `
        <h6>教材檔</h6>
        <ul class="m-0 p-0" style="list-style-type: none;">
            ${lesson.files.map(file => `
                <li>
                    <button class="btn btn-outline-danger m-1" onclick="deleteMat('${lesson._id}', '${file._id}', true)">-</button>
                    <a href="course/lessons/${lesson._id}/files/${file._id}" target="_blank">${file.name}</a>
                </li>
            `).join('')}
        </ul>
        ${lesson.links.length?`<hr></hr><h6>參考連結</h6><ul class="m-0 p-0" style="list-style-type: none;">`:''}
            ${lesson.links.map(link => `
                <li>
                    <button class="btn btn-outline-danger m-1" onclick="deleteMat('${lesson._id}', '${link._id}', false)">-</button>
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
            <th>${index+1}</th>
            <td>${hw.name?hw.name:''}</td>
            <td>${hw.description?hw.description:''}</td>
            <td>${hw.src?hw.src.map(src => {`
                <a href="${src.path}" target="_blank">${src.name}</a>
            `}).join(''):''}</td>
            <td>${hw.attribute ? (hw.attribute=="i" ? 個人 : 團體) : ''}</td>
            <td>${hw.category ? 
                (hw.category=="c" ? 
                    `<button type="button" class="btn btn-outline-dark">自訂</button>` 
                    : `<button type="button" class="btn btn-outline-dark">加入</button>`) 
                : ''}</td>
            <td>
                ${hw.uploaded?hw.uploaded.map(up => {`
                    <button type="button" class="btn btn-danger">-</button>
                    <a href="${up.path}" target="_blank">${up.name}</a>
                `}).join(''):''}
                <button type="button" class="btn btn-outline-dark">+</button>
            </td>
        </tr>
    `).join('')}`;
    $("#homework-table tbody").append(newHome);
}

function addSemester() {
    let newSemester = $("#semesterInput").val();
    if(!newSemester) {alert("學期不能為空");}
    else {
        $.post("/course/addSemester", {name: newSemester})
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
                let newSemester = ` <li><a class="dropdown-item" href="#" id="${semester.id}" onclick="updateSemesterFields({name: ${semester.name}, id: ${semester.id}})">${semester.name}</a></li>`;
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
    $("#semester").text(currentSemester.name+" 學期");
    fetchLessons();
}

function fetchSemesterCode() {
    $("#semesterCode").text(currentSemester.id);
}

function deleteLesson(lesson) {
    let confirm_ans = confirm(`確定要刪除單元：${lesson.name}嗎？\n（刪除後教材、作業皆不會保留）`);
    if(confirm_ans){
        $.post("/course/deleteLesson", {lessonId: lesson._id})
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