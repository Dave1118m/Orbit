using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrbitApi.Migrations
{
    /// <inheritdoc />
    public partial class Phase4_IndexingAndConcurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tasks_ProjectId",
                table: "Tasks");

            migrationBuilder.DropIndex(
                name: "IX_Projects_WorkspaceId",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_FinancialTransactions_BankAccountId",
                table: "FinancialTransactions");

            migrationBuilder.DropIndex(
                name: "IX_FinancialTransactions_OrganizationId",
                table: "FinancialTransactions");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_ProjectId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_BudgetLineItems_BudgetId",
                table: "BudgetLineItems");

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "FinancialTransactions",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Expenses",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<int>(
                name: "FiscalYear",
                table: "Budgets",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "BudgetLineItems",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "BankAccounts",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AlterColumn<string>(
                name: "Entity",
                table: "AuditLogs",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_ProjectId_Status_IsDeleted",
                table: "Tasks",
                columns: new[] { "ProjectId", "Status", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Projects_WorkspaceId_Status_IsDeleted",
                table: "Projects",
                columns: new[] { "WorkspaceId", "Status", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsRead_CreatedAt",
                table: "Notifications",
                columns: new[] { "UserId", "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_BankAccountId_Date",
                table: "FinancialTransactions",
                columns: new[] { "BankAccountId", "TransactionDate" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_OrgId_Type",
                table: "FinancialTransactions",
                columns: new[] { "OrganizationId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_ProjectId_Category_ApprovalStatus",
                table: "Expenses",
                columns: new[] { "ProjectId", "CategoryId", "ApprovalStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_BudgetLineItems_BudgetId_CategoryId",
                table: "BudgetLineItems",
                columns: new[] { "BudgetId", "CategoryId" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Entity_Timestamp",
                table: "AuditLogs",
                columns: new[] { "Entity", "Timestamp" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tasks_ProjectId_Status_IsDeleted",
                table: "Tasks");

            migrationBuilder.DropIndex(
                name: "IX_Projects_WorkspaceId_Status_IsDeleted",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_IsRead_CreatedAt",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_FinancialTransactions_BankAccountId_Date",
                table: "FinancialTransactions");

            migrationBuilder.DropIndex(
                name: "IX_FinancialTransactions_OrgId_Type",
                table: "FinancialTransactions");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_ProjectId_Category_ApprovalStatus",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_BudgetLineItems_BudgetId_CategoryId",
                table: "BudgetLineItems");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_Entity_Timestamp",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "FinancialTransactions");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "FiscalYear",
                table: "Budgets");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "BudgetLineItems");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "BankAccounts");

            migrationBuilder.AlterColumn<string>(
                name: "Entity",
                table: "AuditLogs",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_ProjectId",
                table: "Tasks",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_WorkspaceId",
                table: "Projects",
                column: "WorkspaceId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_BankAccountId",
                table: "FinancialTransactions",
                column: "BankAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancialTransactions_OrganizationId",
                table: "FinancialTransactions",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_ProjectId",
                table: "Expenses",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_BudgetLineItems_BudgetId",
                table: "BudgetLineItems",
                column: "BudgetId");
        }
    }
}
