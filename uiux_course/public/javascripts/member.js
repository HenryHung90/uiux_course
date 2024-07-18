let currentSemester;
let lessons;

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
        .done((data) => {
            $("#semesters ul").empty();
            let semesters = JSON.parse(data);
            semesters.forEach(semester => {
                let newSemester = `<li><a class="dropdown-item" href="#" id="${semester.id}" onclick="updateSemesterFields({name: ${semester.name}, id: ${semester.id}})">${semester.name}</a></li>`;
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

function fetchLessons() {
    $.post("/course/fetchLessons", {semester: currentSemester.name})
        .done((data) => {
            lessons = JSON.parse(data);
            $("#lesson-name-list").empty();
            for(let i = 0; i < lessons.length; i++) {
                lesson = lessons[i];
                let newLesson = 
                    `<button class="btn w-100 text-start p-2 border-bottom border-1 border-light-subtitle lesson-list" type="button" id="${lesson._id}Btn" onclick="showLessonData('${i}')">${lesson.name}</button>`;
                $("#lesson-name-list").append(newLesson);
            }
            // Click 1st lesson
            $(`#${lessons[0]._id}Btn`).click();
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