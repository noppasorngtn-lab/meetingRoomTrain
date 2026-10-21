import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../common/clock';
import { DatabaseModule } from '../../common/database/database.module';
import { UtilizationReportController } from './utilization-report.controller';
import { UtilizationReportService } from './utilization-report.service';

@Module({
  imports: [DatabaseModule],
  controllers: [UtilizationReportController],
  providers: [{ provide: CLOCK, useValue: systemClock }, UtilizationReportService],
})
export class ReportsModule {}
