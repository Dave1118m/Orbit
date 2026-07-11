using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class AlignMigrationsAfterManualEdits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Users_UserId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Users_PerformedByUserId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Projects_ProjectId",
                table: "Expenses");

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Users_UserId",
                table: "Attachments",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Users_PerformedByUserId",
                table: "AuditLogs",
                column: "PerformedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Projects_ProjectId",
                table: "Expenses",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Users_UserId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Users_PerformedByUserId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Projects_ProjectId",
                table: "Expenses");

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Users_UserId",
                table: "Attachments",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Users_PerformedByUserId",
                table: "AuditLogs",
                column: "PerformedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Projects_ProjectId",
                table: "Expenses",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
