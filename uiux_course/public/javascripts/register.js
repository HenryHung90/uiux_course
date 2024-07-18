$().ready(function() {
    $("#isTeacher").on("click", () => {
        if($("#tCodeInput").is(":visible")) {
            $("#sIdInput").prop('disabled', false);
            $("#tCodeInput").val("");
            $("#tCodeInput").hide();
        } else {
            $("#tCodeInput").show();
            $("#sIdInput").val("");
            $("#sIdInput").prop('disabled', true);
        }
    })
})