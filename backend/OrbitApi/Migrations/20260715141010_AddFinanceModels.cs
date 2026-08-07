using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Contribution",
                table: "Donors");

            migrationBuilder.RenameColumn(
                name: "AllocatedProject",
                table: "Donors",
                newName: "PrimaryContact");


            migrationBuilder.AddColumn<string>(
                name: "Country",
                table: "Donors",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailAddress",
                table: "Donors",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "Donors",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BankAccounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<int>(type: "int", nullable: false),
                    BankName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AccountName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AccountNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SwiftCode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankAccounts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankAccounts_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DonorCommunications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DonorId = table.Column<int>(type: "int", nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Method = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LoggedByUserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DonorCommunications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DonorCommunications_Donors_DonorId",
                        column: x => x.DonorId,
                        principalTable: "Donors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DonorCommunications_Users_LoggedByUserId",
                        column: x => x.LoggedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DonorContributions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DonorId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    AllocatedProjectId = table.Column<int>(type: "int", nullable: true),
                    AllocatedTaskId = table.Column<int>(type: "int", nullable: true),
                    BankAccountId = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DonorContributions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DonorContributions_BankAccounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalTable: "BankAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DonorContributions_Donors_DonorId",
                        column: x => x.DonorId,
                        principalTable: "Donors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DonorContributions_Projects_AllocatedProjectId",
                        column: x => x.AllocatedProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DonorContributions_Tasks_AllocatedTaskId",
                        column: x => x.AllocatedTaskId,
                        principalTable: "Tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                });


            migrationBuilder.CreateIndex(
                name: "IX_BankAccounts_OrganizationId",
                table: "BankAccounts",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_DonorCommunications_DonorId",
                table: "DonorCommunications",
                column: "DonorId");

            migrationBuilder.CreateIndex(
                name: "IX_DonorCommunications_LoggedByUserId",
                table: "DonorCommunications",
                column: "LoggedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DonorContributions_AllocatedProjectId",
                table: "DonorContributions",
                column: "AllocatedProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_DonorContributions_AllocatedTaskId",
                table: "DonorContributions",
                column: "AllocatedTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_DonorContributions_BankAccountId",
                table: "DonorContributions",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_DonorContributions_DonorId",
                table: "DonorContributions",
                column: "DonorId");

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DonorCommunications");

            migrationBuilder.DropTable(
                name: "DonorContributions");

            migrationBuilder.DropTable(
                name: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "Country",
                table: "Donors");

            migrationBuilder.DropColumn(
                name: "EmailAddress",
                table: "Donors");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "Donors");

            migrationBuilder.RenameColumn(
                name: "PrimaryContact",
                table: "Donors",
                newName: "AllocatedProject");

            migrationBuilder.AddColumn<decimal>(
                name: "Contribution",
                table: "Donors",
                type: "decimal(18,2)",
                nullable: true);
        }
    }
}
