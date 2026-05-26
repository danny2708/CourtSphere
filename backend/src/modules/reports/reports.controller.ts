import type { Request, Response } from "express";

import type {
  GroupedReportsQuery,
  ReportsDateRangeQuery,
  ViolatingUsersReportQuery
} from "./reports.types";
import { reportsService, type ReportsService } from "./reports.service";

export class ReportsController {
  constructor(private readonly service: ReportsService = reportsService) {}

  getOverview = async (req: Request, res: Response): Promise<void> => {
    const overview = await this.service.getOverview(req.query as unknown as ReportsDateRangeQuery);

    res.status(200).json({ overview });
  };

  getBookingReport = async (req: Request, res: Response): Promise<void> => {
    const report = await this.service.getBookingReport(req.query as unknown as GroupedReportsQuery);

    res.status(200).json({ report });
  };

  getRevenueReport = async (req: Request, res: Response): Promise<void> => {
    const report = await this.service.getRevenueReport(req.query as unknown as GroupedReportsQuery);

    res.status(200).json({ report });
  };

  getCourtUsageReport = async (req: Request, res: Response): Promise<void> => {
    const report = await this.service.getCourtUsageReport(
      req.query as unknown as ReportsDateRangeQuery
    );

    res.status(200).json({ report });
  };

  getRatesReport = async (req: Request, res: Response): Promise<void> => {
    const report = await this.service.getRatesReport(req.query as unknown as ReportsDateRangeQuery);

    res.status(200).json({ report });
  };

  getViolatingUsersReport = async (req: Request, res: Response): Promise<void> => {
    const report = await this.service.getViolatingUsersReport(
      req.query as unknown as ViolatingUsersReportQuery
    );

    res.status(200).json({ report });
  };
}

export const reportsController = new ReportsController();
