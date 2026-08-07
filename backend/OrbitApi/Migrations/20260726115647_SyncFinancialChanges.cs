using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class SyncFinancialChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "Expenses",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "DonorContributions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "BudgetLineItems",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FinancialCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Type = table.Column<int>(type: "int", nullable: false),
                    ParentCategoryId = table.Column<int>(type: "int", nullable: true),
                    Color = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Icon = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TargetBudgetLimit = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    IsSystem = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialCategories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FinancialCategories_FinancialCategories_ParentCategoryId",
                        column: x => x.ParentCategoryId,
                        principalTable: "FinancialCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FinancialCategories_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FinancialTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrganizationId = table.Column<int>(type: "int", nullable: false),
                    TransactionNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ExchangeRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BaseCurrencyAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: true),
                    BankAccountId = table.Column<int>(type: "int", nullable: true),
                    ToBankAccountId = table.Column<int>(type: "int", nullable: true),
                    ProjectId = table.Column<int>(type: "int", nullable: true),
                    TaskId = table.Column<int>(type: "int", nullable: true),
                    ExpenseId = table.Column<int>(type: "int", nullable: true),
                    DonorContributionId = table.Column<int>(type: "int", nullable: true),
                    PayeeOrPayer = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ReferenceNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_BankAccounts_BankAccountId",
                        column: x => x.BankAccountId,
                        principalTable: "BankAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_BankAccounts_ToBankAccountId",
                        column: x => x.ToBankAccountId,
                        principalTable: "BankAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_DonorContributions_DonorContributionId",
                        column: x => x.DonorContributionId,
                        principalTable: "DonorContributions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_Expenses_ExpenseId",
                        column: x => x.ExpenseId,
                        principalTable: "Expenses",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_FinancialCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "FinancialCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_Tasks_TaskId",
                        column: x => x.TaskId,
                        principalTable: "Tasks",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FinancialTransactions_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_CategoryId",
                table: "Expenses",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_DonorContributions_CategoryId",
                table: "DonorContributions",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_BudgetLineItems_CategoryId",
                table: "BudgetLineItems",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialCategories_OrganizationId",
                table: "FinancialCategories",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialCategories_ParentCategoryId",
                table: "FinancialCategories",
                column: "ParentCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_BankAccountId",
                table: "FinancialTransactions",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_CategoryId",
                table: "FinancialTransactions",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_CreatedByUserId",
                table: "FinancialTransactions",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_DonorContributionId",
                table: "FinancialTransactions",
                column: "DonorContributionId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_ExpenseId",
                table: "FinancialTransactions",
                column: "ExpenseId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_OrganizationId",
                table: "FinancialTransactions",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_ProjectId",
                table: "FinancialTransactions",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_TaskId",
                table: "FinancialTransactions",
                column: "TaskId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_ToBankAccountId",
                table: "FinancialTransactions",
                column: "ToBankAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_BudgetLineItems_FinancialCategories_CategoryId",
                table: "BudgetLineItems",
                column: "CategoryId",
                principalTable: "FinancialCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_DonorContributions_FinancialCategories_CategoryId",
                table: "DonorContributions",
                column: "CategoryId",
                principalTable: "FinancialCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_FinancialCategories_CategoryId",
                table: "Expenses",
                column: "CategoryId",
                principalTable: "FinancialCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BudgetLineItems_FinancialCategories_CategoryId",
                table: "BudgetLineItems");

            migrationBuilder.DropForeignKey(
                name: "FK_DonorContributions_FinancialCategories_CategoryId",
                table: "DonorContributions");

            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_FinancialCategories_CategoryId",
                table: "Expenses");

            migrationBuilder.DropTable(
                name: "FinancialTransactions");

            migrationBuilder.DropTable(
                name: "FinancialCategories");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_CategoryId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_DonorContributions_CategoryId",
                table: "DonorContributions");

            migrationBuilder.DropIndex(
                name: "IX_BudgetLineItems_CategoryId",
                table: "BudgetLineItems");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "DonorContributions");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "BudgetLineItems");
        }
    }
}
