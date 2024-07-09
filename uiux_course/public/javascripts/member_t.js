let currentSemester;

$().ready(function() {
    updateSemesters();
})

function addLesson() {
    let l_name = $("#l-name").val();
    let l_files = $("#l-files")[0].files;
    
    if (!l_name) {
        alert("教學單元不應為空");
    } else {
        let formData = new FormData();
        let homeworks = [];
        formData.append('name', l_name);
        // Extract data from homework table
        $("#l-homeworks tbody tr").each(function() {
            if($(this).find("textarea").val()) {
                homeworks.push({
                    id: this.id,
                    description: $(this).find("textarea").val()
                })
            }
        });
        if(homeworks) {
            formData.append("hws", JSON.stringify(homeworks));
        }
        formData.append('semester', currentSemester.name);

        // 添加文件到 formData 对象中
        for (let i = 0; i < l_files.length; i++) {
            formData.append('files', l_files[i]);
        }

        $.ajax({
            url: "/course/addLesson",
            type: "POST",
            data: formData,
            processData: false,  // Not precess the data
            contentType: false,  // Not set the content type
            success: function(res) {
                if (res == "Created") {
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
            let lessons = JSON.parse(data);
            $("#lessons-table tbody").empty();
            for(let i = 0; i < lessons.length; i++) {
                let lesson = lessons[i];
                let newLesson = // TODO: id duplicate
                `<tr>
                    <th scope="row">${i+1}</th>
                    <td id="${lesson._id}">${lesson.name}</td>
                    <td id="${lesson._id}">
                        <ul>
                            ${lesson.files.map(file => `
                                <li>
                                    <a href="course/lessons/${lesson._id}/files/${file._id}" target="_blank">${file.name}</a>
                                </li>
                            `).join('')}
                        </ul>
                    </td>
                    <td id="${lesson._id}">
                        <ul>
                            ${lesson.hws.map(hw => `
                                <li>
                                    <p>${hw.description}</p>
                                </li>
                            `).join('')}
                        </ul>
                    </td>
                    <td> 
                        <button class="btn btn-outline-secondary" id="btnUpdate${lesson._id}" type="button">編輯</button>
                        <button class="btn btn-outline-secondary" id="btnRemove${lesson._id}" type="button" onclick='deleteLesson(${JSON.stringify(lesson)})'>刪除</button>
                    </td>
                </tr>` 
                $("#lessons-table tbody").append(newLesson);
            }
        })
        .fail((xhr, status, error) => {
            alert("更新課程單元失敗");
            console.log("更新課程單元失敗： ", error);
        })
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