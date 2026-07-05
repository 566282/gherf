import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalyticsReport } from '@/services/api/analytics';

export type AnalyticsDatasetKey =
  | 'all'
  | 'userGrowth'
  | 'activeUsers'
  | 'revenue'
  | 'taskCompletion'
  | 'retention'
  | 'campaignPerformance'
  | 'rewardDistribution'
  | 'withdrawalStatistics'
  | 'referralPerformance'
  | 'geographicStatistics'
  | 'deviceStatistics'
  | 'browserStatistics'
  | 'conversionFunnels';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

type DataRow = Record<string, string | number>;

const DATASET_LABELS: Record<Exclude<AnalyticsDatasetKey, 'all'>, string> = {
  userGrowth: 'User Growth',
  activeUsers: 'Active Users',
  revenue: 'Revenue',
  taskCompletion: 'Task Completion',
  retention: 'Retention',
  campaignPerformance: 'Campaign Performance',
  rewardDistribution: 'Reward Distribution',
  withdrawalStatistics: 'Withdrawal Statistics',
  referralPerformance: 'Referral Performance',
  geographicStatistics: 'Geographic Statistics',
  deviceStatistics: 'Device Statistics',
  browserStatistics: 'Browser Statistics',
  conversionFunnels: 'Conversion Funnels',
};

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? '');
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

function buildCsv(rows: DataRow[]): string {
  if (!rows.length) {
    return 'No data\n';
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header] ?? '')).join(','));
  }

  return lines.join('\n');
}

function toDatasetRows(report: AnalyticsReport, dataset: Exclude<AnalyticsDatasetKey, 'all'>): DataRow[] {
  switch (dataset) {
    case 'userGrowth':
      return report.userGrowth.map((point) => ({ date: point.label, new_users: point.value }));
    case 'activeUsers':
      return report.activeUsers.map((point) => ({ date: point.label, active_users: point.value }));
    case 'revenue':
      return report.revenue.map((point) => ({ date: point.label, revenue: point.value }));
    case 'taskCompletion':
      return report.taskCompletion.map((point) => ({ date: point.label, task_completion_rate_percent: point.value }));
    case 'retention':
      return report.retention.map((point) => ({ date: point.label, retention_rate_percent: point.value }));
    case 'campaignPerformance':
      return report.campaignPerformance.map((campaign) => ({
        campaign_id: campaign.campaignId,
        campaign_title: campaign.campaignTitle,
        participants: campaign.participants,
        submissions: campaign.submissions,
        approval_rate_percent: campaign.approvalRate,
        rewards_issued: campaign.rewardsIssued,
        spend: campaign.spend,
      }));
    case 'rewardDistribution':
      return report.rewardDistribution.map((entry) => ({ reward_status: entry.label, count: entry.value }));
    case 'withdrawalStatistics':
      return [
        ...report.withdrawalStatistics.byStatus.map((entry) => ({
          section: 'by_status',
          label: entry.label,
          value: entry.value,
          total_requests: report.withdrawalStatistics.totalRequests,
          total_volume: report.withdrawalStatistics.totalVolume,
          approved_rate_percent: report.withdrawalStatistics.approvedRate,
        })),
        ...report.withdrawalStatistics.byMethod.map((entry) => ({
          section: 'by_method',
          label: entry.label,
          value: entry.value,
          total_requests: report.withdrawalStatistics.totalRequests,
          total_volume: report.withdrawalStatistics.totalVolume,
          approved_rate_percent: report.withdrawalStatistics.approvedRate,
        })),
      ];
    case 'referralPerformance':
      return report.referralPerformance.referralsByDay.map((entry) => ({
        date: entry.label,
        referred_users: entry.value,
        total_referred_users: report.referralPerformance.referredUsers,
        referral_commissions: report.referralPerformance.referralCommissions,
      }));
    case 'geographicStatistics':
      return report.geographicStatistics.map((entry) => ({ geography: entry.label, submissions: entry.value }));
    case 'deviceStatistics':
      return report.deviceStatistics.map((entry) => ({ device: entry.label, submissions: entry.value }));
    case 'browserStatistics':
      return report.browserStatistics.map((entry) => ({ browser: entry.label, submissions: entry.value }));
    case 'conversionFunnels':
      return report.conversionFunnels.map((entry) => ({
        step: entry.step,
        users: entry.users,
        conversion_from_previous_percent: entry.conversionFromPrevious,
      }));
    default:
      return [];
  }
}

function allDatasetRows(report: AnalyticsReport): Array<{ title: string; rows: DataRow[] }> {
  const keys = Object.keys(DATASET_LABELS) as Array<Exclude<AnalyticsDatasetKey, 'all'>>;
  return keys.map((key) => ({
    title: DATASET_LABELS[key],
    rows: toDatasetRows(report, key),
  }));
}

function exportCsv(report: AnalyticsReport, dataset: AnalyticsDatasetKey): void {
  if (dataset === 'all') {
    const sections = allDatasetRows(report)
      .map(({ title, rows }) => `# ${title}\n${buildCsv(rows)}`)
      .join('\n\n');

    triggerDownload(new Blob([sections], { type: 'text/csv;charset=utf-8;' }), `analytics-report-${report.rangeDays}d.csv`);
    return;
  }

  const rows = toDatasetRows(report, dataset);
  const csv = buildCsv(rows);
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `analytics-${dataset}-${report.rangeDays}d.csv`);
}

function exportExcel(report: AnalyticsReport, dataset: AnalyticsDatasetKey): void {
  const workbook = XLSX.utils.book_new();

  if (dataset === 'all') {
    for (const { title, rows } of allDatasetRows(report)) {
      const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ empty: 'No data available' }]);
      XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31));
    }
  } else {
    const rows = toDatasetRows(report, dataset);
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ empty: 'No data available' }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, DATASET_LABELS[dataset].slice(0, 31));
  }

  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  triggerDownload(new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `analytics-report-${report.rangeDays}d.xlsx`);
}

function exportPdf(report: AnalyticsReport, dataset: AnalyticsDatasetKey): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const generatedAt = new Date(report.generatedAt).toLocaleString();

  doc.setFontSize(16);
  doc.text('Analytics and Reporting', 14, 14);
  doc.setFontSize(10);
  doc.text(`Range: last ${report.rangeDays} days`, 14, 20);
  doc.text(`Generated: ${generatedAt}`, 14, 25);

  const sections = dataset === 'all' ? allDatasetRows(report) : [{ title: DATASET_LABELS[dataset], rows: toDatasetRows(report, dataset) }];

  let startY = 32;
  sections.forEach((section, index) => {
    if (index > 0) {
      doc.addPage('a4', 'landscape');
      startY = 18;
    }

    doc.setFontSize(12);
    doc.text(section.title, 14, startY);

    const rows = section.rows.length ? section.rows : [{ empty: 'No data available' }];
    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      startY: startY + 4,
      head: [headers],
      body: rows.map((row) => headers.map((header) => String(row[header] ?? ''))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [32, 41, 56] },
      margin: { left: 14, right: 14 },
    });
  });

  doc.save(`analytics-report-${report.rangeDays}d.pdf`);
}

export function exportAnalyticsReport(report: AnalyticsReport, format: ExportFormat, dataset: AnalyticsDatasetKey): void {
  if (format === 'csv') {
    exportCsv(report, dataset);
    return;
  }

  if (format === 'excel') {
    exportExcel(report, dataset);
    return;
  }

  exportPdf(report, dataset);
}
