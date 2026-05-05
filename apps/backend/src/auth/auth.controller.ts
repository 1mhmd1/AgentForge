import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt.guard';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { Res } from '@nestjs/common';
import { loadEnvFile } from 'process';
loadEnvFile('.env');
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(
      body.email,
      body.password,
      body.name,
    );
  }

@Post('login')
async login(@Body() body: any, @Res() res: Response) {
  const user = await this.authService.validateUser(
    body.email,
    body.password,
  );

  const { access_token } = await this.authService.login(user);

  res.cookie('token', access_token, {
    httpOnly: true,
    secure: false, // true in production (HTTPS)
    sameSite: 'lax',
  });

  return res.json({ message: 'Logged in' });
}
@Get('google')
@UseGuards(AuthGuard('google'))
googleAuth() {
  // redirects to Google
}

@Get('google/callback')
@UseGuards(AuthGuard('google'))
async googleCallback(@Req() req : Request, @Res() res: Response) {
  const user = req.user;

  const token = await this.authService.login(user);

  res.cookie('token', token.access_token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  });

  return res.redirect('FRONTEND_URL'); // frontend
}

  // 🔥 Protected route
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: Request) {
    return req.user;
  }
}