import { Body, Controller, Logger, Post } from '@nestjs/common';
import { OrderReportService } from './order-report.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ReportQueryDto } from './dto/report-query.dto';
@Controller('report')
export class ReportController {
  private readonly logger = new Logger(ReportController.name);

  constructor(private readonly reportService: OrderReportService) {}

  @MessagePattern({ cmd: 'generate-report' })
  async generate(@Payload() params: ReportQueryDto) {
    return await this.reportService.generate(params);
  }

  @Post()
  async generateManually(@Body() params: ReportQueryDto) {
    return await this.reportService.generate(params);
  }
}
