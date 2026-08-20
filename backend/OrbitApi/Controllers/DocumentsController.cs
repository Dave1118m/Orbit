using ClosedXML.Excel;
using iText.IO.Font.Constants;
using iText.Kernel.Colors;
using iText.Kernel.Font;
using iText.Kernel.Geom;
using iText.Kernel.Pdf;
using iText.Layout;
using iText.Layout.Element;
using iText.Layout.Properties;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;

using OrbitApi.Services;

namespace OrbitApi.Controllers;

/// <summary>
/// Institutional Reporting and Document Generation Controller producing styled executive PDF reports,
/// multi-tab ClosedXML workbooks, statement of activities, donor ledgers, and risk matrices.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private readonly OrbitDbContext _db;
    private readonly ICurrencyService _currencyService;

    public DocumentsController(OrbitDbContext db, ICurrencyService currencyService)
    {
        _db = db;
        _currencyService = currencyService;
    }

    // ── Request DTO ────────────────────────────────────────────────────────────

    public class GenerateReportRequest
    {
        public string ReportType { get; set; } = "master_executive_pack";
        public string DateRange { get; set; } = "ytd";
        public bool IncludeAuditHeader { get; set; } = true;
        public int? ProjectId { get; set; }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private int GetOrgId() =>
        Request.Headers.TryGetValue("X-Organization-Id", out var v) && int.TryParse(v, out var id) ? id : 0;

    private static string ReportTitle(string type) => type switch
    {
        "master_executive_pack"   => "Consolidated Executive Master Report",
        "unified_master_report"   => "Institutional Audit & Programmatic Impact Master Report",
        "statement_of_activities" => "Functional Expense Report",
        "donor_allocations"       => "Grant & Donor Allocations",
        "transaction_ledger"      => "Financial Transaction Ledger",
        "risk_register"           => "Project Risk & Mitigation Matrix",
        "volunteer_impact"        => "Volunteer & Field Workforce Impact",
        "team_analytics"          => "Task & Team Performance Analytics",
        _                         => "Orbit Master Report"
    };

    private async Task<ReportData> FetchAsync(int orgId, int? projectId = null)
    {
        var categories = await _db.FinancialCategories
            .Where(c => c.OrganizationId == orgId)
            .ToListAsync();

        var txnQuery = _db.FinancialTransactions
            .Where(t => t.OrganizationId == orgId);
        if (projectId.HasValue && projectId.Value > 0)
        {
            txnQuery = txnQuery.Where(t => t.ProjectId == projectId.Value);
        }

        var transactions = await txnQuery
            .OrderByDescending(t => t.TransactionDate)
            .Take(500)
            .ToListAsync();

        List<Donor> donors;
        if (projectId.HasValue && projectId.Value > 0)
        {
            var projectDonorIds = await _db.ProjectDonors
                .Where(pd => pd.ProjectId == projectId.Value)
                .Select(pd => pd.DonorId)
                .ToListAsync();

            donors = await _db.Donors
                .Include(d => d.Contributions)
                .Where(d => d.OrganizationId == orgId && projectDonorIds.Contains(d.Id))
                .ToListAsync();
        }
        else
        {
            donors = await _db.Donors
                .Include(d => d.Contributions)
                .Where(d => d.OrganizationId == orgId)
                .ToListAsync();
        }

        var riskQuery = _db.RisksIssues
            .Include(r => r.Project)
            .Where(r => r.Project != null
                     && r.Project.Workspace != null
                     && r.Project.Workspace.OrganizationId == orgId);

        if (projectId.HasValue && projectId.Value > 0)
        {
            riskQuery = riskQuery.Where(r => r.ProjectId == projectId.Value);
        }
        var risks = await riskQuery.ToListAsync();

        List<Volunteer> volunteers;
        if (projectId.HasValue && projectId.Value > 0)
        {
            var projectTaskIds = await _db.Tasks
                .Where(t => t.ProjectId == projectId.Value && !t.IsDeleted)
                .Select(t => t.Id)
                .ToListAsync();

            volunteers = await _db.Volunteers
                .Include(v => v.TaskVolunteers)
                .Include(v => v.VolunteerHours)
                .Where(v => v.OrganizationId == orgId &&
                            (v.TaskVolunteers.Any(tv => projectTaskIds.Contains(tv.TaskId)) ||
                             v.VolunteerHours.Any(vh => projectTaskIds.Contains(vh.TaskId))))
                .ToListAsync();
        }
        else
        {
            volunteers = await _db.Volunteers
                .Where(v => v.OrganizationId == orgId)
                .ToListAsync();
        }

        var taskQuery = _db.Tasks
            .Include(t => t.Project).ThenInclude(p => p!.Workspace)
            .Where(t => !t.IsDeleted
                     && t.Project != null
                     && t.Project.Workspace != null
                     && t.Project.Workspace.OrganizationId == orgId);

        if (projectId.HasValue && projectId.Value > 0)
        {
            taskQuery = taskQuery.Where(t => t.ProjectId == projectId.Value);
        }
        var tasks = await taskQuery.ToListAsync();

        var income = transactions
            .Where(t => t.Type == FinancialTransactionType.Income)
            .Sum(t => t.BaseCurrencyAmount);

        var expenses = transactions
            .Where(t => t.Type == FinancialTransactionType.Expense)
            .Sum(t => t.BaseCurrencyAmount);

        return new ReportData
        {
            Categories   = categories,
            Transactions = transactions,
            Donors       = donors,
            Risks        = risks,
            Volunteers   = volunteers,
            Tasks        = tasks,
            TotalIncome  = income,
            TotalExpenses = expenses,
            NetCashFlow  = income - expenses
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXCEL ENDPOINT
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Generates multi-tab formatted Excel spreadsheet reports.
    /// </summary>
    /// <param name="req">Report parameters, date range, and scope.</param>
    /// <returns>Excel workbook (.xlsx) download stream.</returns>
    [HttpPost("excel")]
    public async Task<IActionResult> GenerateExcel([FromBody] GenerateReportRequest req)
    {
        var orgId = GetOrgId();
        var data = await FetchAsync(orgId, req.ProjectId);

        using var wb = new XLWorkbook();
        wb.Properties.Author = "Orbit Financial System";
        wb.Properties.Title  = $"Orbit — {ReportTitle(req.ReportType)}";

        var hBg = XLColor.FromHtml("#1E293B");
        var hFg = XLColor.White;
        var alt = XLColor.FromHtml("#F8FAFC");

        switch (req.ReportType)
        {
            case "unified_master_report":
            case "master_executive_pack":
                XlSummary(wb, data, hBg, hFg, alt, req.IncludeAuditHeader, orgId);
                XlCategories(wb, data, hBg, hFg, alt);
                XlTransactions(wb, data, hBg, hFg, alt);
                await XlDonorsAsync(wb, data, hBg, hFg, alt);
                XlRisks(wb, data, hBg, hFg, alt);
                XlVolunteers(wb, data, hBg, hFg, alt);
                XlTasks(wb, data, hBg, hFg, alt);
                break;
            case "statement_of_activities": XlCategories(wb, data, hBg, hFg, alt); break;
            case "transaction_ledger":      XlTransactions(wb, data, hBg, hFg, alt); break;
            case "donor_allocations":       await XlDonorsAsync(wb, data, hBg, hFg, alt); break;
            case "risk_register":           XlRisks(wb, data, hBg, hFg, alt); break;
            case "volunteer_impact":        XlVolunteers(wb, data, hBg, hFg, alt); break;
            case "team_analytics":          XlTasks(wb, data, hBg, hFg, alt); break;
            default:
                XlSummary(wb, data, hBg, hFg, alt, req.IncludeAuditHeader, orgId);
                XlCategories(wb, data, hBg, hFg, alt);
                XlTransactions(wb, data, hBg, hFg, alt);
                await XlDonorsAsync(wb, data, hBg, hFg, alt);
                XlRisks(wb, data, hBg, hFg, alt);
                XlVolunteers(wb, data, hBg, hFg, alt);
                XlTasks(wb, data, hBg, hFg, alt);
                break;
        }

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        var fname = $"Orbit_{req.ReportType}_{DateTime.UtcNow:yyyy-MM-dd}.xlsx";
        return File(ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fname);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PDF ENDPOINT
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Generates institutional executive PDF reports with styled letterheads and tables using iText7.
    /// </summary>
    /// <param name="req">Report parameters, date range, and scope.</param>
    /// <returns>PDF document (.pdf) download stream.</returns>
    [HttpPost("pdf")]
    public async Task<IActionResult> GeneratePdf([FromBody] GenerateReportRequest req)
    {
        var orgId = GetOrgId();
        var data = await FetchAsync(orgId, req.ProjectId);

        using var ms = new MemoryStream();
        var writer   = new PdfWriter(ms);
        var pdfDoc   = new PdfDocument(writer);
        var doc      = new Document(pdfDoc, PageSize.A4);
        doc.SetMargins(40, 40, 40, 40);

        var bold    = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);
        var regular = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
        var slate900   = new DeviceRgb(15,  23,  42);
        var indigo600  = new DeviceRgb(79,  70, 229);
        var slate50    = new DeviceRgb(248, 250, 252);
        var slate200   = new DeviceRgb(226, 232, 240);
        var slate400   = new DeviceRgb(148, 163, 184);

        // Audit letterhead
        if (req.IncludeAuditHeader)
        {
            var ht = new Table(UnitValue.CreatePercentArray(new float[] { 70, 30 })).UseAllAvailableWidth();
            ht.AddCell(PdfCell(new Paragraph("ORBIT FINANCIAL SYSTEM")
                    .SetFont(bold).SetFontSize(15).SetFontColor(ColorConstants.WHITE))
                .SetBackgroundColor(slate900).SetPadding(12).SetBorder(iText.Layout.Borders.Border.NO_BORDER));
            ht.AddCell(PdfCell(new Paragraph($"{DateTime.UtcNow:dd MMM yyyy}\nScope: {req.DateRange.ToUpper()}\nOrg: #{orgId}")
                    .SetFont(regular).SetFontSize(8).SetFontColor(new DeviceRgb(203, 213, 225)).SetTextAlignment(TextAlignment.RIGHT))
                .SetBackgroundColor(slate900).SetPadding(12).SetBorder(iText.Layout.Borders.Border.NO_BORDER));
            doc.Add(ht);
            doc.Add(new Paragraph(" ").SetFontSize(4));
        }

        // Report title
        doc.Add(new Paragraph(ReportTitle(req.ReportType))
            .SetFont(bold).SetFontSize(14).SetFontColor(indigo600).SetMarginBottom(10));

        bool isMaster = req.ReportType == "master_executive_pack" || req.ReportType == "unified_master_report";

        if (isMaster || req.ReportType == "statement_of_activities")
        {
            PdfSection(doc, "Executive Financial Overview", bold, indigo600);
            PdfKvTable(doc, regular, bold, slate50, slate200, new[]
            {
                ("Total Grant Revenue",       $"${data.TotalIncome:N2}"),
                ("Total Program Expenditures",$"${data.TotalExpenses:N2}"),
                ("Net Surplus / Cash Flow",   $"${data.NetCashFlow:N2}"),
                ("Total Donors",              data.Donors.Count.ToString()),
                ("Total Volunteers",          data.Volunteers.Count.ToString()),
                ("Total Risks",               data.Risks.Count.ToString()),
                ("Total Tasks",               data.Tasks.Count.ToString()),
            });

            PdfSection(doc, "Statement of Activities — Functional Expenses", bold, indigo600);
            var catRows = data.Categories.Select(c =>
            {
                var isInc = c.Type == FinancialCategoryType.Income;
                var actual = data.Transactions
                    .Where(t => t.CategoryId == c.Id &&
                        (isInc ? t.Type == FinancialTransactionType.Income
                               : t.Type == FinancialTransactionType.Expense))
                    .Sum(t => t.BaseCurrencyAmount);
                var budget = (double)(c.TargetBudgetLimit ?? 0);
                return new[] { c.Code ?? "—", c.Name, isInc ? "Revenue" : "Expense",
                    $"${budget:N2}", $"${actual:N2}", $"${budget-(double)actual:N2}" };
            }).ToList();
            PdfTable(doc, new[] { "Code", "Category", "Type", "Budget", "Actual", "Variance" },
                catRows, regular, bold, indigo600, slate50, slate200);
        }

        if (isMaster || req.ReportType == "donor_allocations")
        {
            PdfSection(doc, "Grant & Donor Allocations", bold, indigo600);
            var donorRows = new List<string[]>();
            foreach (var d in data.Donors)
            {
                var pledged = 0m;
                foreach (var c in d.Contributions.Where(c => c.Status == ContributionStatus.Pledged))
                    pledged += await _currencyService.ConvertAsync(c.Amount, c.Currency, "USD");
                
                var received = 0m;
                foreach (var c in d.Contributions.Where(c => c.Status == ContributionStatus.Received))
                    received += await _currencyService.ConvertAsync(c.Amount, c.Currency, "USD");
                
                var active = d.Contributions.Count;
                donorRows.Add(new[] { d.Name, d.DonorType.ToString(), $"${pledged:N2}", $"${received:N2}", active.ToString() });
            }
            PdfTable(doc, new[] { "Donor Name", "Type", "Pledged", "Received", "Active Grants" },
                donorRows, regular, bold, indigo600, slate50, slate200);
        }

        if (isMaster || req.ReportType == "transaction_ledger")
        {
            PdfSection(doc, "Financial Transaction Audit Ledger", bold, indigo600);
            var txnRows = data.Transactions.Take(100).Select(t => new[]
            {
                t.TransactionNumber,
                t.TransactionDate.ToString("yyyy-MM-dd"),
                t.Type.ToString(),
                $"${t.BaseCurrencyAmount:N2}",
                t.Currency,
                Truncate(t.Description, 45)
            }).ToList();
            PdfTable(doc, new[] { "Txn #", "Date", "Type", "Amount", "CCY", "Description" },
                txnRows, regular, bold, indigo600, slate50, slate200);
        }

        if (isMaster || req.ReportType == "risk_register")
        {
            PdfSection(doc, "Project Risk & Mitigation Matrix", bold, indigo600);
            var riskRows = data.Risks.Select(r => new[]
            {
                r.Project?.Title ?? "General",
                Truncate(r.Description, 45),
                $"L{r.LikelihoodScore} / I{r.ImpactScore}",
                r.Status,
                Truncate(r.MitigationPlan ?? "Standard monitoring", 45)
            }).ToList();
            PdfTable(doc, new[] { "Project", "Risk Description", "L/I Score", "Status", "Mitigation" },
                riskRows, regular, bold, indigo600, slate50, slate200);
        }

        if (isMaster || req.ReportType == "volunteer_impact")
        {
            PdfSection(doc, "Volunteer & Field Workforce Roster", bold, indigo600);
            var volRows = data.Volunteers.Select(v => new[]
            {
                v.Name, v.Email ?? "—",
                Truncate(v.Skills ?? "—", 35),
                v.Availability ?? "—",
                v.BackgroundCheckStatus.ToString()
            }).ToList();
            PdfTable(doc, new[] { "Name", "Email", "Skills", "Availability", "Vetting" },
                volRows, regular, bold, indigo600, slate50, slate200);
        }

        if (isMaster || req.ReportType == "team_analytics")
        {
            PdfSection(doc, "Task & Team Performance Analytics", bold, indigo600);
            var total  = data.Tasks.Count;
            var done   = data.Tasks.Count(t => t.Status == Models.TaskStatus.Done);
            var overdue = data.Tasks.Count(t => t.Status != Models.TaskStatus.Done && t.Deadline < DateTime.UtcNow);
            PdfKvTable(doc, regular, bold, slate50, slate200, new[]
            {
                ("Total Tasks",     total.ToString()),
                ("Completed",       done.ToString()),
                ("Completion Rate", total > 0 ? $"{done * 100.0 / total:F1}%" : "0%"),
                ("Overdue",         overdue.ToString()),
            });
            var taskRows = data.Tasks.Take(80).Select(t => new[]
            {
                Truncate(t.Title ?? "—", 50),
                t.Project?.Title ?? "—",
                t.Status.ToString(),
                t.Deadline.HasValue ? t.Deadline.Value.ToString("yyyy-MM-dd") : "None"
            }).ToList();
            PdfTable(doc, new[] { "Task Title", "Project", "Status", "Deadline" },
                taskRows, regular, bold, indigo600, slate50, slate200);
        }

        doc.Add(new Paragraph($"\nGenerated by Orbit Financial System — {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC")
            .SetFont(regular).SetFontSize(7).SetFontColor(slate400)
            .SetMarginTop(20).SetTextAlignment(TextAlignment.CENTER));

        doc.Close();
        var fn = $"Orbit_{req.ReportType}_{DateTime.UtcNow:yyyy-MM-dd}.pdf";
        return File(ms.ToArray(), "application/pdf", fn);
    }

    // ── PDF helpers ────────────────────────────────────────────────────────────

    private static string Truncate(string? s, int max) =>
        s == null ? "—" : s.Length > max ? s[..max] + "…" : s;

    private static Cell PdfCell(Paragraph p) => new Cell().Add(p);

    private static void PdfSection(Document doc, string title, PdfFont bold, DeviceRgb color)
    {
        doc.Add(new Paragraph(" ").SetFontSize(4));
        doc.Add(new Paragraph(title).SetFont(bold).SetFontSize(10).SetFontColor(color)
            .SetBorderBottom(new iText.Layout.Borders.SolidBorder(color, 1)).SetMarginBottom(5));
    }

    private static void PdfKvTable(Document doc, PdfFont regular, PdfFont bold,
        DeviceRgb bg, DeviceRgb border, (string Key, string Value)[] rows)
    {
        var t = new Table(UnitValue.CreatePercentArray(new float[] { 50, 50 }))
            .UseAllAvailableWidth().SetMarginBottom(8);
        foreach (var (k, v) in rows)
        {
            t.AddCell(new Cell().Add(new Paragraph(k).SetFont(bold).SetFontSize(8))
                .SetBackgroundColor(bg).SetPadding(5)
                .SetBorder(new iText.Layout.Borders.SolidBorder(border, 0.5f)));
            t.AddCell(new Cell().Add(new Paragraph(v).SetFont(regular).SetFontSize(8))
                .SetPadding(5)
                .SetBorder(new iText.Layout.Borders.SolidBorder(border, 0.5f)));
        }
        doc.Add(t);
    }

    private static void PdfTable(Document doc, string[] headers, List<string[]> rows,
        PdfFont regular, PdfFont bold, DeviceRgb accent, DeviceRgb lightBg, DeviceRgb border)
    {
        if (rows.Count == 0)
        {
            doc.Add(new Paragraph("No data available.").SetFont(regular).SetFontSize(8)
                .SetFontColor(border).SetMarginBottom(8));
            return;
        }
        var colW = Enumerable.Repeat(1f, headers.Length).ToArray();
        var t = new Table(UnitValue.CreatePercentArray(colW))
            .UseAllAvailableWidth().SetMarginBottom(12);
        foreach (var h in headers)
            t.AddHeaderCell(new Cell()
                .Add(new Paragraph(h).SetFont(bold).SetFontSize(8).SetFontColor(ColorConstants.WHITE))
                .SetBackgroundColor(accent).SetPadding(5)
                .SetBorder(iText.Layout.Borders.Border.NO_BORDER));
        for (int i = 0; i < rows.Count; i++)
        {
            var bg = i % 2 == 0 ? ColorConstants.WHITE : lightBg;
            foreach (var cell in rows[i])
                t.AddCell(new Cell()
                    .Add(new Paragraph(cell ?? "—").SetFont(regular).SetFontSize(8))
                    .SetBackgroundColor(bg).SetPadding(4)
                    .SetBorder(new iText.Layout.Borders.SolidBorder(border, 0.3f)));
        }
        doc.Add(t);
    }

    // ── Excel helpers ──────────────────────────────────────────────────────────

    private static void XlHeader(IXLWorksheet ws, int row, string[] cols, XLColor bg, XLColor fg)
    {
        for (int c = 0; c < cols.Length; c++)
        {
            var cell = ws.Cell(row, c + 1);
            cell.Value = cols[c];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = fg;
            cell.Style.Fill.BackgroundColor = bg;
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#374151");
        }
    }

    private static void XlRow(IXLWorksheet ws, int row, string[] vals, XLColor alt, bool isAlt)
    {
        for (int c = 0; c < vals.Length; c++)
        {
            var cell = ws.Cell(row, c + 1);
            cell.Value = vals[c] ?? "—";
            cell.Style.Font.FontSize = 10;
            cell.Style.Alignment.WrapText = true;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
            if (isAlt) cell.Style.Fill.BackgroundColor = alt;
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Hair;
            cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#E2E8F0");
        }
    }

    private void XlSummary(XLWorkbook wb, ReportData d, XLColor hBg, XLColor hFg, XLColor alt,
        bool includeHeader, int orgId)
    {
        var ws = wb.Worksheets.Add("Executive Summary");
        ws.ShowGridLines = false;
        int row = 1;

        if (includeHeader)
        {
            ws.Cell(row, 1).Value = "ORBIT FINANCIAL SYSTEM — Institutional Donor Report";
            ws.Cell(row, 1).Style.Font.Bold = true;
            ws.Cell(row, 1).Style.Font.FontSize = 14;
            ws.Cell(row, 1).Style.Font.FontColor = hFg;
            ws.Cell(row, 1).Style.Fill.BackgroundColor = hBg;
            ws.Range(row, 1, row, 4).Merge();
            row++;
            ws.Cell(row, 1).Value = $"Generated: {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC  |  Org ID: #{orgId}";
            ws.Cell(row, 1).Style.Font.Italic = true;
            ws.Cell(row, 1).Style.Font.FontSize = 9;
            row += 2;
        }

        XlHeader(ws, row, new[] { "KPI Metric", "Value" }, hBg, hFg); row++;
        var kvRows = new[]
        {
            new[]{ "Total Grant Revenue",         $"${d.TotalIncome:N2}" },
            new[]{ "Total Program Expenditures",  $"${d.TotalExpenses:N2}" },
            new[]{ "Net Surplus / Cash Flow",      $"${d.NetCashFlow:N2}" },
            new[]{ "Total Registered Donors",      d.Donors.Count.ToString() },
            new[]{ "Total Active Volunteers",      d.Volunteers.Count.ToString() },
            new[]{ "Total Project Risks",          d.Risks.Count.ToString() },
            new[]{ "Total Tasks",                  d.Tasks.Count.ToString() },
        };
        foreach (var r in kvRows) { XlRow(ws, row, r, alt, row % 2 == 0); row++; }
        ws.Columns().AdjustToContents();
    }

    private void XlCategories(XLWorkbook wb, ReportData d, XLColor hBg, XLColor hFg, XLColor alt)
    {
        var ws = wb.Worksheets.Add("Statement of Activities");
        ws.ShowGridLines = false;
        XlHeader(ws, 1, new[] { "Code", "Category Name", "Type", "Budget ($)", "Actual ($)", "Variance ($)" }, hBg, hFg);
        int row = 2;
        foreach (var c in d.Categories)
        {
            var isInc = c.Type == FinancialCategoryType.Income;
            var actual = d.Transactions
                .Where(t => t.CategoryId == c.Id &&
                    (isInc ? t.Type == FinancialTransactionType.Income : t.Type == FinancialTransactionType.Expense))
                .Sum(t => t.BaseCurrencyAmount);
            var budget = (double)(c.TargetBudgetLimit ?? 0);
            XlRow(ws, row, new[]
            {
                c.Code ?? "—", c.Name, isInc ? "Revenue" : "Expense",
                budget.ToString("N2"), ((double)actual).ToString("N2"), (budget - (double)actual).ToString("N2")
            }, alt, row % 2 == 0);
            row++;
        }
        ws.Columns().AdjustToContents();
    }

    private void XlTransactions(XLWorkbook wb, ReportData d, XLColor hBg, XLColor hFg, XLColor alt)
    {
        var ws = wb.Worksheets.Add("Transaction Ledger");
        ws.ShowGridLines = false;
        XlHeader(ws, 1, new[] { "Txn #", "Date", "Type", "Amount ($)", "Currency", "Payee/Payer", "Description", "Reference #" }, hBg, hFg);
        int row = 2;
        foreach (var t in d.Transactions)
        {
            XlRow(ws, row, new[]
            {
                t.TransactionNumber,
                t.TransactionDate.ToString("yyyy-MM-dd"),
                t.Type.ToString(),
                t.BaseCurrencyAmount.ToString("N2"),
                t.Currency,
                t.PayeeOrPayer ?? "—",
                t.Description,
                t.ReferenceNumber ?? "—"
            }, alt, row % 2 == 0);
            row++;
        }
        ws.Columns().AdjustToContents();
        ws.Column(7).Width = 45;
    }

    private async Task XlDonorsAsync(XLWorkbook wb, ReportData d, XLColor hBg, XLColor hFg, XLColor alt)
    {
        var ws = wb.Worksheets.Add("Donor Allocations");
        ws.ShowGridLines = false;
        XlHeader(ws, 1, new[] { "Donor Name", "Type", "Contact", "Email", "Pledged (USD eq.)", "Received (USD eq.)", "Active Grants" }, hBg, hFg);
        int row = 2;
        foreach (var donor in d.Donors)
        {
            var pledged = 0m;
            foreach (var c in donor.Contributions.Where(c => c.Status == ContributionStatus.Pledged))
                pledged += await _currencyService.ConvertAsync(c.Amount, c.Currency, "USD");
            
            var received = 0m;
            foreach (var c in donor.Contributions.Where(c => c.Status == ContributionStatus.Received))
                received += await _currencyService.ConvertAsync(c.Amount, c.Currency, "USD");
                
            var active = donor.Contributions.Count;
            XlRow(ws, row, new[]
            {
                donor.Name, donor.DonorType.ToString(),
                donor.PrimaryContact ?? "—", donor.EmailAddress ?? "—",
                pledged.ToString("N2"), received.ToString("N2"), active.ToString()
            }, alt, row % 2 == 0);
            row++;
        }
        ws.Columns().AdjustToContents();
    }

    private void XlRisks(XLWorkbook wb, ReportData d, XLColor hBg, XLColor hFg, XLColor alt)
    {
        var ws = wb.Worksheets.Add("Risk Register");
        ws.ShowGridLines = false;
        XlHeader(ws, 1, new[] { "Project", "Description", "Likelihood", "Impact", "L Score", "I Score", "Status", "Owner", "Mitigation Plan" }, hBg, hFg);
        int row = 2;
        foreach (var r in d.Risks)
        {
            XlRow(ws, row, new[]
            {
                r.Project?.Title ?? "General",
                r.Description,
                r.Likelihood,
                r.Impact,
                r.LikelihoodScore.ToString(),
                r.ImpactScore.ToString(),
                r.Status,
                r.Owner,
                r.MitigationPlan ?? "Standard monitoring"
            }, alt, row % 2 == 0);
            row++;
        }
        ws.Columns().AdjustToContents();
        ws.Column(9).Width = 50;
    }

    private void XlVolunteers(XLWorkbook wb, ReportData d, XLColor hBg, XLColor hFg, XLColor alt)
    {
        var ws = wb.Worksheets.Add("Volunteer Workforce");
        ws.ShowGridLines = false;
        XlHeader(ws, 1, new[] { "Name", "Email", "Phone", "Skills", "Availability", "Vetting Status" }, hBg, hFg);
        int row = 2;
        foreach (var v in d.Volunteers)
        {
            XlRow(ws, row, new[]
            {
                v.Name, v.Email ?? "—", v.PhoneNumber ?? "—",
                v.Skills ?? "—", v.Availability ?? "—",
                v.BackgroundCheckStatus.ToString()
            }, alt, row % 2 == 0);
            row++;
        }
        ws.Columns().AdjustToContents();
    }

    private void XlTasks(XLWorkbook wb, ReportData d, XLColor hBg, XLColor hFg, XLColor alt)
    {
        var ws = wb.Worksheets.Add("Task Analytics");
        ws.ShowGridLines = false;

        var total   = d.Tasks.Count;
        var done    = d.Tasks.Count(t => t.Status == Models.TaskStatus.Done || t.CompletedDate != null);
        var overdue = d.Tasks.Count(t => t.Status != Models.TaskStatus.Done && t.CompletedDate == null && t.Deadline.HasValue && t.Deadline.Value < DateTime.UtcNow);

        ws.Cell(1, 1).Value = "KPI Summary";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 12;
        XlHeader(ws, 2, new[] { "KPI", "Value" }, hBg, hFg);
        XlRow(ws, 3, new[] { "Total Tasks", total.ToString() }, alt, false);
        XlRow(ws, 4, new[] { "Completed", done.ToString() }, alt, true);
        XlRow(ws, 5, new[] { "Completion Rate", total > 0 ? $"{done * 100.0 / total:F1}%" : "0%" }, alt, false);
        XlRow(ws, 6, new[] { "Overdue", overdue.ToString() }, alt, true);

        ws.Cell(8, 1).Value = "Task Detail";
        ws.Cell(8, 1).Style.Font.Bold = true;
        ws.Cell(8, 1).Style.Font.FontSize = 12;
        XlHeader(ws, 9, new[] { "Task Title", "Project", "Status", "Deadline" }, hBg, hFg);
        int row = 10;
        foreach (var t in d.Tasks)
        {
            XlRow(ws, row, new[]
            {
                t.Title ?? "—",
                t.Project?.Title ?? "—",
                t.Status.ToString(),
                t.Deadline.HasValue ? t.Deadline.Value.ToString("yyyy-MM-dd") : "None"
            }, alt, row % 2 == 0);
            row++;
        }
        ws.Columns().AdjustToContents();
        ws.Column(1).Width = 45;
    }

    // ── Internal data transfer class ───────────────────────────────────────────

    private sealed class ReportData
    {
        public List<FinancialCategory>    Categories   { get; init; } = new();
        public List<FinancialTransaction> Transactions { get; init; } = new();
        public List<Donor>                Donors       { get; init; } = new();
        public List<RiskIssue>            Risks        { get; init; } = new();
        public List<Volunteer>            Volunteers   { get; init; } = new();
        public List<TaskItem>             Tasks        { get; init; } = new();
        public decimal TotalIncome   { get; init; }
        public decimal TotalExpenses { get; init; }
        public decimal NetCashFlow   { get; init; }
    }
}
