import { IsIn, IsDateString } from 'class-validator';

export class ReportQueryDto {
  @IsIn(['Order Report', 'Finance Report'])
  reportType: string;

  @IsDateString()
  reportDate: string; // e.g., '2025-07-10'
}
