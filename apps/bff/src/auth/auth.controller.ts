import { Controller, Post, Body, HttpException, HttpStatus, HttpCode } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginDto } from './dto/login.dto';
import axios from 'axios';




@Controller('auth')
export class AuthController {
  private readonly coreAuthUrl = process.env.TASKS_API_URL;

  constructor(private readonly httpService: HttpService) {}

  @Post('register')
  async register(@Body() body: any) {
    try {
      const response = await axios.post(`${this.coreAuthUrl}/auth/register`, body);

      return response.data;
    } catch (error) {
      throw new HttpException(
        'Error connecting to API',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.coreAuthUrl}/auth/login`, dto)
      );
      return response.data;
    } catch (error: any) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data?.message || 'Erro ao realizar login';
      throw new HttpException(message, status);
    }
  }
  @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${this.coreAuthUrl}/auth/forgot-password`, { email: dto.email })
        );
        return response.data;
      } catch (error: any) {
        const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const message = error.response?.data?.message || 'Erro ao processar solicitação';
        throw new HttpException(message, status);
      }
    }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.coreAuthUrl}/auth/reset-password`, dto)
      );
      return response.data;
    } catch (error: any) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data?.message || 'Erro ao resetar senha';
      throw new HttpException(message, status);
    }
  }
}