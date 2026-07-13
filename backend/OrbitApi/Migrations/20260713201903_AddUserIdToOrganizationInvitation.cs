using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class AddUserIdToOrganizationInvitation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "OrganizationInvitations",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationInvitations_UserId",
                table: "OrganizationInvitations",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_OrganizationInvitations_Users_UserId",
                table: "OrganizationInvitations",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrganizationInvitations_Users_UserId",
                table: "OrganizationInvitations");

            migrationBuilder.DropIndex(
                name: "IX_OrganizationInvitations_UserId",
                table: "OrganizationInvitations");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "OrganizationInvitations");
        }
    }
}
