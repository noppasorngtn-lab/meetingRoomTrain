import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Header, NotFoundException, Param, Patch,
  Post, Query, Res,
} from '@nestjs/common';
import { Caller, CurrentUser, UUID } from '../../common/auth/current-user';
import { NotRoomAdministrator } from '../booking/room-admin';
import {
  PeriodType, ReportLocked, ReportNotFound, ReportPeriodInvalid, UtilizationReport, UtilizationReportService,
} from './utilization-report.service';

/** The one thing asked of the response here — the file's name. */
interface HeaderWriter {
  setHeader(name: string, value: string): void;
}

/** The domain's refusals as HTTP answers, with the domain's words. */
function answer(err: unknown): never {
  if (err instanceof ReportPeriodInvalid) throw new BadRequestException(err.message);
  if (err instanceof ReportNotFound) throw new NotFoundException(err.message);
  if (err instanceof NotRoomAdministrator) throw new ForbiddenException(err.message);
  if (err instanceof ReportLocked) throw new ConflictException(err.message);
  throw err;
}

const periodTypeOf = (v: unknown): PeriodType => {
  if (v !== 'MONTH' && v !== 'YEAR') throw new BadRequestException('periodType ต้องเป็น MONTH หรือ YEAR');
  return v;
};
const periodStartOf = (v: unknown): string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new BadRequestException('periodStart ต้องเป็นวันที่ YYYY-MM-DD');
  return v;
};

/** API-028 · API-029 · API-030 — the utilization report, a Room Administrator's alone (ACL-017). */
@Controller('reports/utilization')
export class UtilizationReportController {
  constructor(private readonly reports: UtilizationReportService) {}

  @Post()
  async issue(@CurrentUser() caller: Caller, @Body() body: Record<string, unknown> = {}): Promise<{ message: string; report: UtilizationReport }> {
    const input = { periodType: periodTypeOf(body.periodType), periodStart: periodStartOf(body.periodStart) };
    try {
      return await this.reports.issue(caller, input);
    } catch (err) {
      answer(err);
    }
  }

  @Get()
  async view(
    @CurrentUser() caller: Caller,
    @Query('periodType') periodType: unknown,
    @Query('periodStart') periodStart: unknown,
    @Query('issueNo') issueNo: unknown,
  ): Promise<UtilizationReport> {
    const n = issueNo === undefined ? undefined : typeof issueNo === 'string' && /^[1-9]\d*$/.test(issueNo) ? Number(issueNo) : NaN;
    if (n !== undefined && !Number.isSafeInteger(n)) throw new BadRequestException('issueNo ต้องเป็นจำนวนเต็มตั้งแต่ 1');
    const input = { periodType: periodTypeOf(periodType), periodStart: periodStartOf(periodStart), issueNo: n };
    try {
      return await this.reports.view(caller, input);
    } catch (err) {
      answer(err);
    }
  }

  @Get(':id/export')
  @Header('content-type', 'text/csv; charset=utf-8')
  async export(@CurrentUser() caller: Caller, @Param('id') id: string, @Res({ passthrough: true }) res: HeaderWriter): Promise<string> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบรายงานฉบับนี้');
    try {
      const file = await this.reports.export(caller, id);
      res.setHeader('content-disposition', `attachment; filename="${file.filename}"`);
      return file.csv;
    } catch (err) {
      answer(err);
    }
  }

  /**
   * AC-mrr-046 — an issued report's numbers are not edited. interfaces.json declares no such
   * operation, so this exists only to say why in the domain's words (the tables refuse it anyway).
   */
  @Patch(':id')
  async edit(@CurrentUser() caller: Caller, @Param('id') id: string): Promise<never> {
    if (!UUID.test(id)) throw new NotFoundException('ไม่พบรายงานฉบับนี้');
    try {
      return await this.reports.refuseEdit(caller, id);
    } catch (err) {
      answer(err);
    }
  }
}
