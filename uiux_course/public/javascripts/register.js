$().ready(function() {
    $("#isTeacher").on("click", () => {
        if($("#tCodeInput").is(":visible")) {
            $("#tCodeInput").hide();
        } else {
            $("#tCodeInput").show();
        }
    })
})