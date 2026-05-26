export type ReportGroupBy = "day" | "month";

export type ReportsDateRangeQuery = {
  fromDate?: Date;
  toDate?: Date;
};

export type GroupedReportsQuery = ReportsDateRangeQuery & {
  groupBy: ReportGroupBy;
};

export type ViolatingUsersReportQuery = ReportsDateRangeQuery & {
  limit: number;
};

export type NormalizedDateRange = {
  fromDate: Date;
  toDate: Date;
};
