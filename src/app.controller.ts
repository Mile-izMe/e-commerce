import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { SuccessMessage } from './common/api/success-message.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @SuccessMessage('Application ready')
  getHello(): string {
    return this.appService.getHello();
  }
}
