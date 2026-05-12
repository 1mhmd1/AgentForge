import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from './jwt.guard';
import { AuthService, IssuedTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

function parseTtlMs(value: string): number {
  const m = /^(\d+)([smhd])$/.exec(value.trim());
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register with email + password' })
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res() res: Response) {
    const tokens = await this.authService.register(dto.email, dto.password, dto.name, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.writeAuthCookies(res, tokens);
    return res.status(HttpStatus.CREATED).json({
      success: true,
      data: { user: tokens.user, token: tokens.access_token },
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    const ctx = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const user = await this.authService.validateUser(dto.email, dto.password, ctx);
    const tokens = await this.authService.login(user, ctx);
    this.writeAuthCookies(res, tokens);
    return res.json({
      success: true,
      data: { user: tokens.user, token: tokens.access_token },
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token, issue a new access token',
    description:
      'Reads the refresh token from the `refresh_token` cookie, rotates it (re-use is detected and revokes the chain), and writes a fresh access cookie.',
  })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const raw = (req.cookies?.refresh_token as string | undefined) ?? '';
    if (!raw) throw new UnauthorizedException('No refresh token');
    const tokens = await this.authService.refresh(raw, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.writeAuthCookies(res, tokens);
    return res.json({
      success: true,
      data: { user: tokens.user, token: tokens.access_token },
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout (revoke refresh tokens)' })
  async logout(
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.authService.logout(userId, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.clearAuthCookies(res);
    return res.json({ success: true, data: { message: 'Logged out' } });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Decoded JWT payload' })
  me(@CurrentUser() user: any) {
    return user;
  }

  // ─── Google OAuth ─────────────────────────────────────
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Begin Google OAuth flow' })
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as { email: string; name: string; googleId: string };
    const tokens = await this.authService.googleLogin(profile, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.writeAuthCookies(res, tokens);
    const frontend = this.config.get<string>('frontendUrl') ?? 'https://agent-forge-frontend-ruby.vercel.app/dashboard';
    return res.redirect(frontend);
  }

  // ─── helpers ──────────────────────────────────────────
  private writeAuthCookies(res: Response, tokens: IssuedTokens) {
    const secure = this.config.get<string>('nodeEnv') === 'production';

    // Access cookie: short, matches JWT_EXPIRES_IN. Browsers will discard the
    // cookie at the same time the JWT expires — no zombie tokens.
    const expiresIn =
      this.config.get<{ expiresIn: string }>('jwt')?.expiresIn ?? '15m';
    const accessMaxAgeMs = parseTtlMs(expiresIn);

    res.cookie('token', tokens.access_token, {
      httpOnly: true,
      secure,
      sameSite: 'none',
      maxAge: accessMaxAgeMs,
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: 'none',
      expires: tokens.refresh_expires_at,
      path: '/api/auth',
    });
  }

  private clearAuthCookies(res: Response) {
    const secure = this.config.get<string>('nodeEnv') === 'production';
    res.clearCookie('token', { httpOnly: true, secure, sameSite: 'none' });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/auth',
    });
  }
}
