import { DynamicModule, Logger, Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { TestControlsController } from './test-controls.controller';

/**
 * Dev-only handles for the end-to-end tests (docs/qa/t1-test-cases.md OQ-T1-01): move the app's clock.
 * Absent unless ENABLE_TEST_CONTROLS=true — the production compose never sets it, and the routes
 * then do not exist (404), not "exist but refuse".
 */
@Module({})
export class TestControlsModule {
  static ifEnabled(): DynamicModule[] {
    if (process.env.ENABLE_TEST_CONTROLS !== 'true') return [];
    new Logger('TestControls').warn('ENABLE_TEST_CONTROLS=true — /__test/* routes are open. Never set this in production.');
    return [{ module: TestControlsModule, imports: [DatabaseModule], controllers: [TestControlsController] }];
  }
}
